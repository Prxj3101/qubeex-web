'use client';

import { Topbar } from '@/components/shared/Topbar';
import { LayoutDashboard, Users, BookOpen, Settings } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Overview', href: '/teacher/overview', icon: LayoutDashboard },
    { label: 'Students', href: '/teacher/students', icon: Users },
    { label: 'Tests', href: '/teacher/tests', icon: BookOpen },
    { label: 'Settings', href: '/teacher/settings', icon: Settings },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}