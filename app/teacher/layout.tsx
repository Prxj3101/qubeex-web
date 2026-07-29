'use client';

import { useEffect } from 'react';
import { Topbar } from '@/components/shared/Topbar';
import { MockInstTypeProvider, useMockInstType } from '@/context/MockInstTypeContext';
import { useUserAvatarStore } from '@/store/userAvatarStore';
import { useUserTitleStore } from '@/store/userTitleStore';
import api from '@/lib/api';
import {
    LayoutDashboard,
    Building2,
    LayoutGrid,
    Monitor,
    ScrollText,
    User,
} from 'lucide-react';

const TEACHER_NAV_ITEMS = [
    { label: 'Overview', href: '/teacher/overview', icon: LayoutDashboard },
    { label: 'Campus', href: '/teacher/campus', icon: Building2, activePath: '/teacher/campus' },
    { label: 'Classes', href: '/teacher/classes', icon: LayoutGrid, activePath: '/teacher/classes' },
    { label: 'Blackboard', href: '/teacher/blackboard', icon: Monitor },
    { label: 'Audit Logs', href: '/teacher/audit-logs', icon: ScrollText },
    { label: 'My Profile', href: '/teacher/profile', icon: User },
];

function TeacherLayoutInner({ children }: { children: React.ReactNode }) {
    const { instType } = useMockInstType();
    const setAvatarUrl = useUserAvatarStore(s => s.setAvatarUrl);
    const setTitle = useUserTitleStore(s => s.setTitle);
    const setPrefix = useUserTitleStore(s => s.setPrefix);
    useEffect(() => {
        api.get('/teacher/me').then(r => {
            const d = r.data?.data;
            setAvatarUrl(d?.avatarUrl ?? null);
            setTitle(d?.title ?? null);
            setPrefix(d?.prefix ?? null);
        }).catch(() => {});
    }, [setAvatarUrl, setTitle, setPrefix]);

    // Same fix as app/admin/layout.tsx: the `theme-college` class on <html>
    // only gets set server-side on a hard page load (RootLayout reads the
    // cookie once per request). Logging in redirects via router.push — a
    // client-side navigation that never re-runs the root Server Component —
    // so <html> keeps whatever class it had *before* login. This effect
    // patches it in immediately client-side. Also mirrored onto the wrapper
    // div below for the non-portaled content, and onto <html> for portaled
    // content (dropdowns/dialogs/toasts render via Portal straight into
    // document.body, outside this div's scope).
    useEffect(() => {
        document.documentElement.classList.toggle('theme-college', instType === 'COLLEGE');
        return () => { document.documentElement.classList.remove('theme-college'); };
    }, [instType]);

    return (
        <div
            suppressHydrationWarning
            className={`flex flex-col h-screen bg-background px-0 pt-3 gap-3 ${instType === 'COLLEGE' ? 'theme-college' : ''}`}
        >
            <Topbar navItems={TEACHER_NAV_ITEMS} />
            <main className="flex-1 min-h-0 px-2 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    return (
        <MockInstTypeProvider>
            <TeacherLayoutInner>{children}</TeacherLayoutInner>
        </MockInstTypeProvider>
    );
}