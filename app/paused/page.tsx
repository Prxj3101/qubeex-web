'use client';

import { PauseCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

export default function PausedPage() {
    const router = useRouter();
    const { clearAuth } = useAuthStore();

    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@qubeex.com';

    const handleLogout = () => {
        clearAuth();
        router.replace('/login');
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md mx-4 rounded-2xl border border-border/50 bg-card p-5 lg:p-8 text-center shadow-sm">
                <div className="mx-auto w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-5">
                    <PauseCircle size={28} className="text-amber-600 dark:text-amber-400" />
                </div>
                <h1 className="text-lg lg:text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                    Institution paused
                </h1>
                <p className="text-sm text-muted-foreground mb-2">
                    Your institution is temporarily paused. Student access is restricted during this period.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                    Please contact your institution admin for more information.
                </p>
                <div className="flex flex-col gap-2">
                    <Button onClick={handleLogout} variant="outline" className="w-full">
                        Logout
                    </Button>
                    <Button variant="ghost" className="w-full text-muted-foreground" asChild>
                        <a href={`mailto:${supportEmail}`}>Contact support</a>
                    </Button>
                </div>
            </div>
        </main>
    );
}
