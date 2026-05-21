'use client';

import { useEffect, useState } from 'react';
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

const Spinner = () => (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0A1E' }}>
        <div className="w-8 h-8 border-2 border-[#DA7756]/30 border-t-[#DA7756] rounded-full animate-spin" />
    </div>
);

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    // ── Hydration gate ──────────────────────────────────────────────────────────
    // Zustand `persist` rehydrates asynchronously from localStorage.
    // We must not read the store until the client has mounted and hydration is done,
    // otherwise the initial null state causes a spurious redirect to /login.
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const persistApi = useAuthStore.persist;
        if (!persistApi) return;
        const unsub = persistApi.onFinishHydration(() => setHydrated(true));
        if (persistApi.hasHydrated()) {
            const timer = window.setTimeout(() => setHydrated(true), 0);
            return () => {
                window.clearTimeout(timer);
                unsub();
            };
        }
        return unsub;
    }, []);

    const { user, token } = useAuthStore();

    useEffect(() => {
        if (!hydrated) return; // wait for localStorage → store sync before checking
        if (!token || !user || user.role !== 'SUPER_ADMIN') {
            router.replace('/login');
        }
    }, [hydrated, token, user, router]);

    // Show spinner while: (a) store hasn't hydrated yet, or (b) not authorized
    if (!hydrated || !token || !user || user.role !== 'SUPER_ADMIN') {
        return <Spinner />;
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
