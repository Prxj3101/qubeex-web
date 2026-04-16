'use client';

import { Topbar } from '@/components/shared/Topbar';
import { LayoutDashboard, Users, GraduationCap, Settings, CreditCard } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
    { label: 'Teachers', href: '/admin/teachers', icon: GraduationCap },
    { label: 'Batches', href: '/admin/batches', icon: Users },
    { label: 'My Subscription', href: '/admin/subscription', icon: CreditCard },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}