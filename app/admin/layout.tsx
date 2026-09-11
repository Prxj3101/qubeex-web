'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Topbar } from '@/components/shared/Topbar';
import { useAuthStore } from '@/store/authStore';
import { useUserAvatarStore } from '@/store/userAvatarStore';
import { useUserTitleStore } from '@/store/userTitleStore';
import api from '@/lib/api';
import {
    LayoutDashboard,
    Building2,
    Users,
    LineChart,
    Headset,
    ScrollText,
    Wallet,
} from 'lucide-react';
import { MockInstTypeProvider, useMockInstType } from '@/context/MockInstTypeContext';

// Parent nav unlocks if user has ANY of the listed child permission keys
const ALL_NAV_ITEMS = [
    { label: 'Overview',   href: '/admin/overview',           icon: LayoutDashboard, childKeys: [] as string[] },
    { label: 'Staff',      href: '/admin/staff',              icon: Users,           childKeys: ['STAFF_TEACHERS', 'STAFF_STAFFROOM', 'STAFF_SUBADMINS'] },
    { label: 'Campus',     href: '/admin/campus',             icon: Building2,       childKeys: ['CAMPUS_VIEW', 'CAMPUS_MANAGE', 'CAMPUS_FEES', 'CAMPUS_ATTENDANCE', 'CAMPUS_MARKSHEET'] },
    { label: 'Insights',   href: '/admin/insights',           icon: LineChart,       activePath: '/admin/insights', childKeys: ['INSIGHTS_ANALYTICS', 'INSIGHTS_SUBSCRIPTION'] },
    // adminOnly: true — hidden from Sub-Admins entirely (not merely locked),
    // since salary data is more sensitive than any module with a Sub-Admin
    // delegation path. See Global Constraints.
    { label: 'Payroll',    href: '/admin/payroll/runs',       icon: Wallet,          activePath: '/admin/payroll',  childKeys: [] as string[], adminOnly: true },
    { label: 'Support',    href: '/admin/support/tickets',    icon: Headset,         activePath: '/admin/support',  childKeys: ['SUPPORT'] },
    { label: 'Audit Logs', href: '/admin/audit-logs',         icon: ScrollText,      childKeys: ['AUDIT_LOGS'] },
];

// Which permission keys gate each path prefix — ordered most-specific first,
// since the first matching prefix wins.
const LOCKED_PREFIX_TO_KEYS: Array<{ prefix: string; keys: string[] }> = [
    { prefix: '/admin/staff/teachers',        keys: ['STAFF_TEACHERS'] },
    { prefix: '/admin/staff/staffroom',       keys: ['STAFF_STAFFROOM'] },
    { prefix: '/admin/staff/subadmins',       keys: ['STAFF_SUBADMINS'] },
    { prefix: '/admin/payroll',               keys: [] },
    { prefix: '/admin/campus/classes',        keys: ['CAMPUS_VIEW', 'CAMPUS_MANAGE', 'CAMPUS_FEES', 'CAMPUS_ATTENDANCE', 'CAMPUS_MARKSHEET'] },
    { prefix: '/admin/campus/courses',        keys: ['CAMPUS_VIEW', 'CAMPUS_MANAGE', 'CAMPUS_FEES', 'CAMPUS_ATTENDANCE', 'CAMPUS_MARKSHEET'] },
    // Bare '/admin/campus' (the Feed page) is intentionally NOT gated here —
    // CampusLayout owns that redirect itself (Feed → Classes/Courses when the
    // sub-admin lacks CAMPUS_FEED). Gating it here too raced against that
    // effect: both fire on mount, and whichever router.replace() lands last
    // won, sometimes bouncing a sub-admin with real Classes access all the
    // way out to Overview. If they end up on Classes/Courses without any
    // class permission either, the rule above still catches that.
    { prefix: '/admin/insights/analytics',    keys: ['INSIGHTS_ANALYTICS'] },
    { prefix: '/admin/insights/subscription', keys: ['INSIGHTS_SUBSCRIPTION'] },
    { prefix: '/admin/insights/users',        keys: ['INSIGHTS_ANALYTICS', 'INSIGHTS_SUBSCRIPTION'] },
    { prefix: '/admin/support',               keys: ['SUPPORT'] },
    { prefix: '/admin/audit-logs',            keys: ['AUDIT_LOGS'] },
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
    const setAvatarUrl = useUserAvatarStore(s => s.setAvatarUrl);
    const setTitle = useUserTitleStore(s => s.setTitle);
    const setPrefix = useUserTitleStore(s => s.setPrefix);
    const isSubAdmin = user?.role === 'SUB_ADMIN';

    // Populate the shared avatar/title/prefix stores from the correct source
    // depending on role — a sub-admin must never inherit the institution's
    // actual Admin's photo/title/prefix, since /admin/me always describes the
    // Admin, not whoever is currently logged in.
    useEffect(() => {
        // Right after a hard refresh the persisted auth store can still be
        // hydrating, so `user` (and therefore `isSubAdmin`) may briefly be
        // stale/undefined. Wait for it before firing either request — otherwise
        // a wrong-role request can go out first and its (slower) response can
        // arrive after the correct one and clobber it back to the wrong data.
        if (!user) return;
        if (isSubAdmin) {
            api.get('/admin/subadmin/me').then(r => {
                const d = r.data?.data;
                setAvatarUrl(d?.avatarUrl ?? null);
                setTitle(d?.designation ?? null);
                setPrefix(d?.prefix ?? null);
            }).catch(() => {});
            return;
        }
        api.get('/admin/me').then(r => {
            const d = r.data?.data;
            if (d?.adminAvatarUrl) setAvatarUrl(d.adminAvatarUrl);
            setTitle(d?.adminTitle ?? null);
            setPrefix(d?.adminPrefix ?? null);
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isSubAdmin]);
    const pathname = usePathname();
    const router = useRouter();

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

    const navItems = ALL_NAV_ITEMS
        .filter(item => !(isSubAdmin && 'adminOnly' in item && item.adminOnly))
        .map(({ childKeys, ...item }) => {
            if (!isSubAdmin || childKeys.length === 0) return { ...item, locked: false };
            return { ...item, locked: !childKeys.some(k => permissions.includes(k)) };
        });

    // The `theme-college` class also needs to live on <html>, not just the
    // inner wrapper below — Radix's dropdown/popover/dialog content renders
    // through a Portal straight into document.body, which sits outside the
    // wrapper div's scope. Without this, portaled UI (the avatar dropdown,
    // any modal, etc.) falls back to the default violet CSS variables even
    // when the rest of the page is correctly showing the college blue theme.
    useEffect(() => {
        document.documentElement.classList.toggle('theme-college', instType === 'COLLEGE');
        return () => { document.documentElement.classList.remove('theme-college'); };
    }, [instType]);

    return (
        <div
            suppressHydrationWarning
            className={`flex flex-col h-screen bg-background px-0 pt-3 gap-3 ${instType === 'COLLEGE' ? 'theme-college' : ''}`}
        >
            <Topbar
                navItems={navItems}
            />
            <main
                className="flex-1 overflow-y-auto overflow-x-hidden px-2 outline-none bg-background visible-scrollbar"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb-strong) transparent' }}
                tabIndex={-1}
            >
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
