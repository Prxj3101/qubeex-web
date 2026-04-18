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
    recentActivity: [
        { id: '1', dot: 'violet', text: 'Teacher Ritu Sharma added to Class 10-A', time: '12 min ago' },
        { id: '2', dot: 'emerald', text: '24 new students enrolled in Class 9', time: '1 hr ago' },
        { id: '3', dot: 'amber', text: 'Plan usage crossed 80% for storage', time: '3 hr ago' },
        { id: '4', dot: 'sky', text: 'Monthly test results published', time: '1 day ago' },
        { id: '5', dot: 'violet', text: 'Admin settings updated', time: '2 days ago' },
    ],
    notifications: [
        { id: 'n1', title: 'Upgrade available', body: 'A new plan tier is available with more storage.', time: '2 hr ago' },
        { id: 'n2', title: 'Maintenance window', body: 'Scheduled maintenance on 2026-04-22 from 2-4 AM IST.', time: '1 day ago' },
        { id: 'n3', title: 'New feature: Bulk imports', body: 'You can now import students via CSV.', time: '3 days ago' },
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
        <div className="space-y-6">
            <OverviewHero
                adminName={adminName}
                institutionName={overview.institution.name}
                institutionType={overview.institution.type}
            />

            <StatCards
                stats={overview.stats}
                institutionType={overview.institution.type}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">
                    <EnrollmentGrowthChart
                        data={overview.enrollmentGrowth}
                        institutionType={overview.institution.type}
                    />
                </div>
                <PlanUsageCard plan={overview.plan} />
            </div>

            <div className="flex flex-col gap-3">
                <RecentActivityCard activity={overview.recentActivity} />
                <NotificationsPreviewCard notifications={overview.notifications} />
            </div>
        </div>
    );
}
