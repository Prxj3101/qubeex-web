'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { AdminOverview } from '@/types';
import { OverviewHero } from '@/components/admin/OverviewHero';
import { StatCards } from '@/components/admin/StatCards';
import { EnrollmentGrowthChart } from '@/components/admin/EnrollmentGrowthChart';
import { PlanUsageCard } from '@/components/admin/PlanUsageCard';
import { RecentActivityCard } from '@/components/admin/RecentActivityCard';
import { NotificationsPreviewCard } from '@/components/admin/NotificationsPreviewCard';
import { Skeleton } from '@/components/ui/skeleton';
import { WelcomeBanner } from '@/components/admin/WelcomeBanner';
import { Sparkles } from 'lucide-react';

// TODO: wire to API — backend endpoint /admin/overview not confirmed ready.
const MOCK_OVERVIEW: AdminOverview = {
    institution: {
        id: 'inst-mock',
        name: 'Delhi Public School',
        type: 'SCHOOL',
        status: 'ACTIVE',
    },
    stats: {
        totalUsers: 248,
        totalStudents: 210,
        totalTeachers: 18,
        totalClasses: 12,
    },
    enrollmentGrowth: [
        { month: 'Nov', students: 180, teachers: 14 },
        { month: 'Dec', students: 188, teachers: 15 },
        { month: 'Jan', students: 194, teachers: 16 },
        { month: 'Feb', students: 201, teachers: 16 },
        { month: 'Mar', students: 206, teachers: 17 },
        { month: 'Apr', students: 210, teachers: 18 },
    ],
    plan: {
        name: 'Pro',
        usage: {
            users: { used: 248, limit: 500 },
            storage: { used: 1840, limit: 5120 },
            tests: { used: 142, limit: 1000 },
        },
    },
    auditLogs: [
        { id: '1', dot: 'violet', action: 'Teacher Added', actor: 'Admin', detail: 'Ritu Sharma added to Class 10-A', time: '12 min ago' },
        { id: '2', dot: 'emerald', action: 'Students Enrolled', actor: 'Admin', detail: '24 students enrolled in Class 9', time: '1 hr ago' },
        { id: '3', dot: 'amber', action: 'Plan Usage Alert', actor: 'System', detail: 'Storage usage crossed 80%', time: '3 hr ago' },
        { id: '4', dot: 'sky', action: 'Results Published', actor: 'Admin', detail: 'Monthly test results published', time: '1 day ago' },
        { id: '5', dot: 'violet', action: 'Settings Updated', actor: 'Admin', detail: 'Admin settings updated', time: '2 days ago' },
    ],
    tickets: [
        { id: 'TKT-001', title: 'Test submissions not saving', category: 'BUG', priority: 'URGENT', status: 'IN_PROGRESS', createdAt: '2 hrs ago' },
        { id: 'TKT-002', title: 'Request for CSV bulk import', category: 'FEATURE', priority: 'MEDIUM', status: 'OPEN', createdAt: '1 day ago' },
        { id: 'TKT-003', title: 'March invoice incorrect amount', category: 'BILLING', priority: 'HIGH', status: 'OPEN', createdAt: '3 days ago' },
    ],
};

export default function AdminOverviewPage() {
    const { user } = useAuthStore();
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchOverview() {
            try {
                const res = await api.get('/admin/overview');
                if (!cancelled) setOverview(res.data.data);
            } catch {
                if (!cancelled) setOverview(MOCK_OVERVIEW);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchOverview();
        return () => { cancelled = true; };
    }, []);

    if (loading || !overview) {
        return (
            <div className="space-y-6">
                <Skeleton className="-mx-4 h-48 rounded-b-[65px]" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-28 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-56 rounded-xl" />
            </div>
        );
    }

    const adminName = user?.email?.split('@')[0] ?? 'Admin';

    return (
        <div className="space-y-3">
            <OverviewHero
                adminName={adminName}
                institutionName={overview.institution.name}
                institutionType={overview.institution.type}
            />
            <WelcomeBanner
                adminName={adminName}
                institutionName={overview.institution.name}
                institutionType={overview.institution.type}
                plan="PRO"
            />

            <StatCards
                stats={overview.stats}
                institutionType={overview.institution.type}
            />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-stretch">

                {/* Graph — 2 cols */}
                <div className="lg:col-span-2">
                    <EnrollmentGrowthChart
                        data={overview.enrollmentGrowth}
                        institutionType={overview.institution.type}
                    />
                </div>

                {/* AI Tokens — 2 cols */}
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={15} className="text-muted-foreground" />
                        <p className="text-sm font-medium">AI Token Usage</p>
                    </div>
                    <div className="space-y-1.5 mb-4">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Institution pool</span>
                            <span className="font-semibold">4.4M <span className="text-muted-foreground font-normal">/ 10M</span></span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: '44%', background: '#DA7757' }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>44% used</span>
                            <span>5.6M remaining</span>
                        </div>
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Per Teacher</p>
                    <div className="space-y-2">
                        {[
                            { name: 'Ritu Sharma', used: 1.2 },
                            { name: 'Ankit Verma', used: 0.8 },
                            { name: 'Priya Nair', used: 0.6 },
                            { name: 'Meena Patel', used: 1.4 },
                            { name: 'Suresh Iyer', used: 0.4 },
                        ].map(t => (
                            <div key={t.name} className="flex items-center gap-3">
                                <span className="text-[11px] text-muted-foreground w-20 shrink-0 truncate">{t.name}</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(t.used / 10) * 100}%`, background: '#7C3AED' }} />
                                </div>
                                <span className="text-[11px] font-semibold w-8 text-right">{t.used}M</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3">🔄 Resets 1st of every month</p>
                </div>

                {/* Plan — 1 col */}
                <div className="lg:col-span-1">
                    <PlanUsageCard plan={overview.plan} />
                </div>

            </div>

            <div className="flex flex-col gap-3">
                <RecentActivityCard auditLogs={overview.auditLogs} />
                <NotificationsPreviewCard tickets={overview.tickets} />
            </div>
        </div>
    );
}
