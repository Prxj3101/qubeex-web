'use client';

import { ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

export default function SuspendedPage() {
    const router = useRouter();
    const { clearAuth } = useAuthStore();

    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@qubeex.com';

    const handleLogout = () => {
        clearAuth();
        router.replace('/login');
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-8 text-center shadow-sm">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center mb-5">
                    <ShieldAlert size={28} className="text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                    Institution suspended
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                    Your institution&apos;s access has been suspended. Please contact your super admin.
                </p>
                <div className="flex flex-col gap-2">
                    <Button onClick={handleLogout} className="w-full">
                        Logout
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                        <a href={`mailto:${supportEmail}`}>Contact support</a>
                    </Button>
                </div>
            </div>
        </main>
    );
}
