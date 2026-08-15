'use client';

import { useEffect, useRef, useState } from 'react';
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
import { BirthdayBanner } from '@/components/shared/BirthdayBanner';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { formatDisplayName } from '@/lib/displayName';
import { formatTokens } from '@/lib/utils';

export default function AdminOverviewPage() {
    const { user } = useAuthStore();
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { instType } = useMockInstType();
    const fetchedRef = useRef(false);
    const [adminDob, setAdminDob] = useState<string | null>(null);
    const [institutionEstablishedOn, setInstitutionEstablishedOn] = useState<string | null>(null);
    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const [subAdminPrefix, setSubAdminPrefix] = useState<string | null>(null);

    useEffect(() => {
        // Wait for the auth store to actually hydrate — right after a refresh
        // `user` (and isSubAdmin) can briefly be stale, which would fetch the
        // wrong role's data on this one-time effect.
        if (!user) return;
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        api.get('/admin/overview')
            .then(res => setOverview(res.data.data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
        // Fetch profile for birthday data — silent fail (non-critical)
        api.get('/admin/me')
            .then(res => {
                const d = res.data?.data ?? res.data;
                if (!d) return;
                const adminUser = d.admin ?? d.users?.find((u: { role: string }) => u.role === 'ADMIN');
                setAdminDob(adminUser?.dob ?? d.adminDob ?? null);
                setInstitutionEstablishedOn(d.establishedOn ?? null);
            })
            .catch(() => {});
        // A sub-admin's own prefix lives on their own SubAdmin row, never on
        // Institution.adminPrefix (that always describes the real Admin).
        if (isSubAdmin) {
            api.get('/admin/subadmin/me')
                .then(res => {
                    const d = res.data?.data ?? res.data;
                    setSubAdminPrefix(d?.prefix ?? null);
                })
                .catch(() => {});
        }
    }, [user, isSubAdmin]);

    // Background poll — surfaces superadmin-side plan/feature/status changes without a manual reload.
    useEffect(() => {
        const poll = setInterval(() => {
            api.get('/admin/overview').then(res => setOverview(res.data.data)).catch(() => {});
        }, 30_000);
        return () => clearInterval(poll);
    }, []);

    if (loading) {
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

    if (error || !overview) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <AlertCircle size={28} className="text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Could not load overview</p>
                <p className="text-xs text-muted-foreground/60">Refresh the page to try again</p>
            </div>
        );
    }

    const adminName = formatDisplayName(
        user?.name ?? user?.email?.split('@')[0] ?? 'Admin',
        isSubAdmin ? subAdminPrefix : overview.institution.adminPrefix
    );
    const planName = overview.plan.name.toUpperCase() as 'PRO' | 'BASIC' | 'TRIAL';

    return (
        <div className="space-y-3 pb-3">
            <OverviewHero
                adminName={adminName}
                institutionName={overview.institution.name}
                institutionType={instType}
                adminDob={adminDob ?? undefined}
                institutionEstablishedOn={institutionEstablishedOn ?? undefined}
            />
            {overview.showWelcomeBanner && (
                <WelcomeBanner
                    adminName={adminName}
                    institutionName={overview.institution.name}
                    institutionType={instType}
                    plan={planName}
                    storagePct={
                        overview.plan.usage.storage.limit
                            ? (overview.plan.usage.storage.used / overview.plan.usage.storage.limit) * 100
                            : 0
                    }
                />
            )}
            <BirthdayBanner
                name={overview.institution.name}
                role="institution"
                dob={institutionEstablishedOn ?? ''}
            />
            <BirthdayBanner
                name={adminName}
                role="admin"
                dob={adminDob ?? ''}
            />
            <StatCards
                stats={overview.stats}
                institutionType={instType}
                plan={overview.plan}
            />

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 items-stretch">

                {/* Graph — 2 cols */}
                <div className="lg:col-span-3">
                    <EnrollmentGrowthChart
                        data={overview.enrollmentGrowth}
                        institutionType={instType}
                    />
                </div>

                {/* AI Tokens — 2 cols */}
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={15} className="text-muted-foreground" />
                        <p className="text-sm font-medium">AI Token Usage</p>
                        <span className="ml-auto text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">Institution pool</span>
                    </div>
                    {(() => {
                        const aiUsed = overview.plan.usage.aiTokens.used;
                        const aiLimit = overview.plan.usage.aiTokens.limit || 1;
                        const aiPct = Math.min(100, Math.round((aiUsed / aiLimit) * 100));
                        return (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-semibold">
                                        {formatTokens(aiUsed)}
                                        <span className="text-sm font-normal text-muted-foreground"> / {formatTokens(aiLimit)} tokens</span>
                                    </p>
                                    <p className="text-sm font-semibold text-muted-foreground">{aiPct}%</p>
                                </div>
                                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${aiPct}%`, background: aiPct > 85 ? '#ef4444' : aiPct > 70 ? '#f59e0b' : 'var(--primary)' }} />
                                </div>
                                <p className="text-[11px] text-muted-foreground/60">Shared across all teachers</p>
                            </div>
                        );
                    })()}
                </div>

                {/* Plan — 1 col */}
                <div className="lg:col-span-2">
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
