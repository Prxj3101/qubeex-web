'use client';

import { Topbar } from '@/components/shared/Topbar';
import { LayoutDashboard, BookOpen, BarChart3, Settings } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Overview', href: '/student/overview', icon: LayoutDashboard },
    { label: 'My Courses', href: '/student/courses', icon: BookOpen },
    { label: 'Results', href: '/student/results', icon: BarChart3 },
    { label: 'Settings', href: '/student/settings', icon: Settings },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}