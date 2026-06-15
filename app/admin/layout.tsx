'use client';

import { Topbar } from '@/components/shared/Topbar';
import { useAuthStore } from '@/store/authStore';
import {
    LayoutDashboard,
    Building2,
    Users,
    LineChart,
    Headset,
    ScrollText,
} from 'lucide-react';
import { MockInstTypeProvider, useMockInstType } from '@/context/MockInstTypeContext';

const ALL_NAV_ITEMS = [
    { label: 'Overview',   href: '/admin/overview',           icon: LayoutDashboard, permission: null as string | null },
    { label: 'Staff',      href: '/admin/staff',              icon: Users,           permission: null as string | null },
    { label: 'Campus',     href: '/admin/campus',             icon: Building2,       permission: 'CAMPUS' as string | null },
    { label: 'Insights',   href: '/admin/insights/analytics', icon: LineChart,       activePath: '/admin/insights', permission: null as string | null },
    { label: 'Support',    href: '/admin/support/tickets',    icon: Headset,         activePath: '/admin/support',  permission: null as string | null },
    { label: 'Audit Logs', href: '/admin/audit-logs',         icon: ScrollText,      permission: null as string | null },
];

const ADMIN_ONLY_LABELS = new Set(['Staff', 'Insights', 'Audit Logs']);

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { instType, setInstType } = useMockInstType();
    const { user } = useAuthStore();

    const navItems = ALL_NAV_ITEMS.filter(item => {
        if (user?.role !== 'SUB_ADMIN') return true;
        if (ADMIN_ONLY_LABELS.has(item.label)) return false;
        if (item.permission && !user.permissions?.includes(item.permission)) return false;
        return true;
    }).map(({ permission, ...rest }) => rest);

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar
                navItems={navItems}
                devToggle={
                    user?.role === 'ADMIN' ? (
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
                    ) : null
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
