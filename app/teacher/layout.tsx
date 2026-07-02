'use client';

import { useEffect } from 'react';
import { Topbar } from '@/components/shared/Topbar';
import { MockInstTypeProvider } from '@/context/MockInstTypeContext';
import { useUserAvatarStore } from '@/store/userAvatarStore';
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
    const setAvatarUrl = useUserAvatarStore(s => s.setAvatarUrl);
    useEffect(() => {
        api.get('/teacher/me').then(r => setAvatarUrl(r.data?.data?.avatarUrl ?? null)).catch(() => {});
    }, [setAvatarUrl]);
    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
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