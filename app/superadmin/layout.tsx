'use client';


import { Topbar } from '@/components/shared/Topbar';
import { LayoutDashboard, Building2, ScrollText, KeyRound } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Overview', href: '/superadmin/overview', icon: LayoutDashboard },
    { label: 'Institutions', href: '/superadmin/institutions', icon: Building2 },
    { label: 'Audit Logs', href: '/superadmin/audit-logs', icon: ScrollText },
    { label: 'My Vault', href: '/superadmin/vault', icon: KeyRound },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}