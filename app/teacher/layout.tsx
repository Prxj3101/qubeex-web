'use client';

import { Topbar } from '@/components/shared/Topbar';
import { MockInstTypeProvider } from '@/context/MockInstTypeContext';
import {
    LayoutDashboard,
    Building2,
    LayoutGrid,
    Monitor,
    HeadphonesIcon,
} from 'lucide-react';

const TEACHER_NAV_ITEMS = [
    { label: 'Overview', href: '/teacher/overview', icon: LayoutDashboard },
    { label: 'Campus', href: '/teacher/campus', icon: Building2, activePath: '/teacher/campus' },
    { label: 'Classes', href: '/teacher/classes', icon: LayoutGrid, activePath: '/teacher/classes' },
    { label: 'Blackboard', href: '/teacher/blackboard', icon: Monitor },
    { label: 'Support & Logs', href: '/teacher/support', icon: HeadphonesIcon },
];

function TeacherLayoutInner({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={TEACHER_NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
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