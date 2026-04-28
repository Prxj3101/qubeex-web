'use client';

import { Topbar } from '@/components/shared/Topbar';
import { WelcomeBanner } from '@/components/admin/WelcomeBanner';
import { useEffect, useState } from 'react';
import {
    LayoutDashboard,
    Building2,
    Users,
    LineChart,
    Headset,
    ScrollText,
} from 'lucide-react';

const ADMIN_NAV_ITEMS = [
    { label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
    { label: 'Structure', href: '/admin/structure', icon: Building2 },
    { label: 'People', href: '/admin/people', icon: Users },
    { label: 'Insights', href: '/admin/insights/analytics', icon: LineChart },
    { label: 'Support', href: '/admin/support/notifications', icon: Headset },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(true);
    }, []);

    if (!ready) return null;

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={ADMIN_NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}   