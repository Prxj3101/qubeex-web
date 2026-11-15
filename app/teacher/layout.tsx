'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Topbar } from '@/components/shared/Topbar';
import { MockInstTypeProvider, useMockInstType } from '@/context/MockInstTypeContext';
import { AcademicYearProvider } from '@/context/AcademicYearContext';
import { AcademicYearSelector } from '@/components/shared/AcademicYearSelector';
import { HistoricalYearBanner } from '@/components/shared/HistoricalYearBanner';
import { useUserAvatarStore } from '@/store/userAvatarStore';
import { useUserTitleStore } from '@/store/userTitleStore';
import { useParentChatBadgeStore } from '@/store/parentChatBadgeStore';
import api from '@/lib/api';
import {
    LayoutDashboard,
    Building2,
    LayoutGrid,
    MessageCircle,
    Monitor,
    Library,
    User,
} from 'lucide-react';

const TEACHER_NAV_ITEMS = [
    { label: 'Overview', href: '/teacher/overview', icon: LayoutDashboard },
    { label: 'Campus', href: '/teacher/campus', icon: Building2, activePath: '/teacher/campus' },
    { label: 'Classes', href: '/teacher/classes', icon: LayoutGrid, activePath: '/teacher/classes' },
    { label: 'Blackboard', href: '/teacher/blackboard', icon: Monitor },
    { label: 'Parents', href: '/teacher/parents', icon: MessageCircle },
    { label: 'Library', href: '/teacher/library', icon: Library },
    { label: 'My Profile', href: '/teacher/profile', icon: User },
];

function TeacherLayoutInner({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        document.documentElement.classList.add('teacher-shadow-theme');
        return () => document.documentElement.classList.remove('teacher-shadow-theme');
    }, []);
    const { instType } = useMockInstType();
    const pathname = usePathname();
    const unreadParentMessages = useParentChatBadgeStore(s => s.teacherUnread);
    const setUnreadParentMessages = useParentChatBadgeStore(s => s.setTeacherUnread);
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

    // Unread parent messages for the "Parents" nav item. Refetched on navigation
    // (reading a thread clears it) and polled so new messages show up without a reload.
    useEffect(() => {
        let cancelled = false;
        const load = () => {
            api.get('/teacher/parent-chat/unread-count')
                .then(r => { if (!cancelled) setUnreadParentMessages(r.data?.data?.unread ?? 0); })
                .catch(() => {});
        };
        load();
        const timer = setInterval(load, 30_000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [pathname, setUnreadParentMessages]);

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

    const navItems = TEACHER_NAV_ITEMS.map(item =>
        item.href === '/teacher/parents' ? { ...item, badgeCount: unreadParentMessages } : item
    );

    return (
        <div
            suppressHydrationWarning
            className={`flex flex-col h-screen bg-background px-0 pt-3 gap-3 ${instType === 'COLLEGE' ? 'theme-college' : ''}`}
        >
            <Topbar navItems={navItems} navRightSlot={pathname.startsWith('/teacher/classes') ? <AcademicYearSelector /> : undefined} />
            <HistoricalYearBanner />
            <main className="flex-1 min-h-0 px-2 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    return (
        <MockInstTypeProvider>
            <AcademicYearProvider>
                <TeacherLayoutInner>{children}</TeacherLayoutInner>
            </AcademicYearProvider>
        </MockInstTypeProvider>
    );
}
