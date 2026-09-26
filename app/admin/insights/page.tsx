'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

// Priority order mirrors the tab order in ./layout.tsx — first entry the
// sub-admin has permission for wins, so the section opens on a tab they can
// actually use instead of always landing on Analytics.
const INSIGHTS_TABS_PRIORITY = [
    { href: '/admin/insights/analytics', permKey: 'INSIGHTS_ANALYTICS' },
    { href: '/admin/insights/subscription', permKey: 'INSIGHTS_SUBSCRIPTION' },
    { href: '/admin/insights/audit-logs', permKey: 'AUDIT_LOGS' },
];

export default function InsightsIndexPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    useEffect(() => {
        if (user?.role !== 'SUB_ADMIN') {
            router.replace('/admin/insights/analytics');
            return;
        }
        const permissions = user.permissions ?? [];
        const first = INSIGHTS_TABS_PRIORITY.find(t => permissions.includes(t.permKey));
        router.replace(first ? first.href : '/admin/overview');
    }, [user, router]);

    return null;
}
