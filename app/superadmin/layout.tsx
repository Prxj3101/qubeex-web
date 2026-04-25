'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/shared/Topbar';
import { useAuthStore } from '@/store/authStore';
import { LayoutDashboard, Building2, ScrollText, Headset, Activity, KeyRound } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Overview',     href: '/superadmin/overview',     icon: LayoutDashboard },
    { label: 'Institutions', href: '/superadmin/institutions', icon: Building2 },
    { label: 'Audit Logs',   href: '/superadmin/audit-logs',   icon: ScrollText },
    { label: 'Support',      href: '/superadmin/support',      icon: Headset },
    { label: 'System & AI',  href: '/superadmin/system',       icon: Activity },
    { label: 'My Vault',     href: '/superadmin/vault',        icon: KeyRound },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const router  = useRouter();
    const { user, token } = useAuthStore();

    useEffect(() => {
        // Not logged in at all
        if (!token || !user) {
            router.replace('/login');
            return;
        }
        // Logged in but not a SuperAdmin
        if (user.role !== 'SUPER_ADMIN') {
            router.replace('/login');
        }
    }, [user, token, router]);

    // Don't render the layout until we've confirmed the role
    if (!token || !user || user.role !== 'SUPER_ADMIN') {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0A1E' }}>
                <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}