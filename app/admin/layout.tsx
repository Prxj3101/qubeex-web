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
import { MockInstTypeProvider, useMockInstType } from '@/context/MockInstTypeContext';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { instType, setInstType } = useMockInstType();
    const [ready, setReady] = useState(false);

    useEffect(() => { setReady(true); }, []);
    if (!ready) return null;

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar
                navItems={ADMIN_NAV_ITEMS}
                devToggle={
                    <div className="flex items-center gap-1.5">
                        {(['SCHOOL', 'COLLEGE', 'COACHING'] as const).map(type => (
                            <button key={type} onClick={() => setInstType(type)}
                                className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-all ${instType === type
                                        ? 'bg-primary text-white border-primary'
                                        : 'border-border/50 text-muted-foreground hover:text-foreground'
                                    }`}>
                                {type}
                            </button>
                        ))}
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <MockInstTypeProvider>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </MockInstTypeProvider>
    );
}

const ADMIN_NAV_ITEMS = [
    { label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
    { label: 'Staff', href: '/admin/staff', icon: Users },
    { label: 'Campus', href: '/admin/campus', icon: Building2 },
    { label: 'Insights', href: '/admin/insights/analytics', icon: LineChart },
    { label: 'Support', href: '/admin/support/notifications', icon: Headset },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText },
];

