'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Topbar } from '@/components/shared/Topbar';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import {
    LayoutDashboard,
    Building2,
    Users,
    LineChart,
    Headset,
    ScrollText,
} from 'lucide-react';
import { MockInstTypeProvider, useMockInstType } from '@/context/MockInstTypeContext';

// Parent nav unlocks if user has ANY of the listed child permission keys
const ALL_NAV_ITEMS = [
    { label: 'Overview',   href: '/admin/overview',           icon: LayoutDashboard, childKeys: [] as string[] },
    { label: 'Staff',      href: '/admin/staff',              icon: Users,           childKeys: ['STAFF_TEACHERS', 'STAFF_STAFFROOM', 'STAFF_SUBADMINS'] },
    { label: 'Campus',     href: '/admin/campus',             icon: Building2,       childKeys: ['CAMPUS_VIEW', 'CAMPUS_MANAGE', 'CAMPUS_FEES', 'CAMPUS_ATTENDANCE', 'CAMPUS_MARKSHEET'] },
    { label: 'Insights',   href: '/admin/insights/analytics', icon: LineChart,       activePath: '/admin/insights', childKeys: ['INSIGHTS'] },
    { label: 'Support',    href: '/admin/support/tickets',    icon: Headset,         activePath: '/admin/support',  childKeys: ['SUPPORT'] },
    { label: 'Audit Logs', href: '/admin/audit-logs',         icon: ScrollText,      childKeys: ['AUDIT_LOGS'] },
];

// Which permission keys gate each path prefix
const LOCKED_PREFIX_TO_KEYS: Array<{ prefix: string; keys: string[] }> = [
    { prefix: '/admin/staff',      keys: ['STAFF_TEACHERS', 'STAFF_STAFFROOM', 'STAFF_SUBADMINS'] },
    { prefix: '/admin/campus',     keys: ['CAMPUS_VIEW', 'CAMPUS_MANAGE', 'CAMPUS_FEES', 'CAMPUS_ATTENDANCE', 'CAMPUS_MARKSHEET'] },
    { prefix: '/admin/insights',   keys: ['INSIGHTS'] },
    { prefix: '/admin/support',    keys: ['SUPPORT'] },
    { prefix: '/admin/audit-logs', keys: ['AUDIT_LOGS'] },
];

function isPathAccessible(pathname: string, permissions: string[]): boolean {
    for (const { prefix, keys } of LOCKED_PREFIX_TO_KEYS) {
        if (pathname.startsWith(prefix)) {
            return keys.some(k => permissions.includes(k));
        }
    }
    return true;
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const { instType } = useMockInstType();
    const { user, setUser } = useAuthStore();
    const pathname = usePathname();
    const router = useRouter();

    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    // Keep a ref to user so the async callback always reads the latest value without being a dep
    const userRef = useRef(user);
    userRef.current = user;
    const lastSyncRef = useRef(0);

    // Re-sync permissions from DB on every navigation, throttled to once per 30 s.
    // This ensures the store stays current when an admin updates permissions mid-session.
    useEffect(() => {
        if (!isSubAdmin) return;
        const now = Date.now();
        if (now - lastSyncRef.current < 30_000) return;
        lastSyncRef.current = now;
        api.get('/admin/subadmin/me').then(res => {
            const fresh: string[] | null = res.data?.data?.permissions;
            const currentUser = userRef.current;
            if (!currentUser) return;
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(currentUser.permissions)) {
                setUser({ ...currentUser, permissions: fresh });
            }
        }).catch(() => { /* non-blocking */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSubAdmin, pathname]);

    // Background poll every 30 s so permission changes surface even without navigation.
    useEffect(() => {
        if (!isSubAdmin) return;
        const poll = setInterval(() => {
            api.get('/admin/subadmin/me').then(res => {
                const fresh: string[] | null = res.data?.data?.permissions;
                const currentUser = userRef.current;
                if (!currentUser) return;
                if (fresh && JSON.stringify(fresh) !== JSON.stringify(currentUser.permissions)) {
                    lastSyncRef.current = Date.now();
                    setUser({ ...currentUser, permissions: fresh });
                }
            }).catch(() => { /* non-blocking */ });
        }, 30_000);
        return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSubAdmin]);

    useEffect(() => {
        if (isSubAdmin && !isPathAccessible(pathname, permissions)) {
            router.replace('/admin/overview');
        }
    }, [isSubAdmin, pathname, permissions, router]);

    const navItems = ALL_NAV_ITEMS.map(({ childKeys, ...item }) => {
        if (!isSubAdmin) return { ...item, locked: false };
        if (childKeys.length === 0) return { ...item, locked: false };
        const hasAccess = childKeys.some(k => permissions.includes(k));
        return { ...item, locked: !hasAccess };
    });

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar
                navItems={navItems}
            />
            <main className="flex-1 overflow-y-auto overflow-x-hidden px-2 outline-none bg-background" tabIndex={-1}>
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
