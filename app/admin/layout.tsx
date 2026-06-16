'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
    { label: 'Staff',      href: '/admin/staff',              icon: Users,           permission: null as string | null, subAdminLocked: true },
    { label: 'Campus',     href: '/admin/campus',             icon: Building2,       permission: 'CAMPUS_OR_FEES' as string | null },
    { label: 'Insights',   href: '/admin/insights/analytics', icon: LineChart,       activePath: '/admin/insights', permission: null as string | null, subAdminLocked: true },
    { label: 'Support',    href: '/admin/support/tickets',    icon: Headset,         activePath: '/admin/support',  permission: null as string | null },
    { label: 'Audit Logs', href: '/admin/audit-logs',         icon: ScrollText,      permission: null as string | null, subAdminLocked: true },
];

// Paths that redirect to overview when a subadmin tries to access them directly
const SUBADMIN_LOCKED_PREFIXES = ['/admin/staff', '/admin/insights', '/admin/audit-logs'];

function canSubAdminAccessPath(pathname: string, permissions: string[]): boolean {
    if (SUBADMIN_LOCKED_PREFIXES.some(p => pathname.startsWith(p))) return false;
    if (pathname.startsWith('/admin/campus') && !permissions.includes('CAMPUS') && !permissions.includes('FEES')) return false;
    return true;
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { instType, setInstType } = useMockInstType();
    const { user } = useAuthStore();
    const pathname = usePathname();
    const router = useRouter();

    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    // Redirect subadmins away from locked URLs
    useEffect(() => {
        if (isSubAdmin && !canSubAdminAccessPath(pathname, permissions)) {
            router.replace('/admin/overview');
        }
    }, [isSubAdmin, pathname, permissions, router]);

    const navItems = ALL_NAV_ITEMS.map(item => {
        const { permission, subAdminLocked, ...rest } = item;

        if (!isSubAdmin) return { ...rest, locked: false };

        if (subAdminLocked) return { ...rest, locked: true };

        if (permission === 'CAMPUS_OR_FEES') {
            const canAccess = permissions.includes('CAMPUS') || permissions.includes('FEES');
            return { ...rest, locked: !canAccess };
        }

        return { ...rest, locked: false };
    });

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
