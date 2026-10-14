'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { ChangePasswordModal } from '@/components/admin/ChangePasswordModal';
import { LogOut, KeyRound } from 'lucide-react';

interface AccountCardProps {
    email: string;
}

export function AccountCard({ email }: AccountCardProps) {
    const { clearAuth } = useAuthStore();
    const router = useRouter();
    const [changePwOpen, setChangePwOpen] = useState(false);

    const handleLogout = () => {
        clearAuth();
        toast.success('Logged out');
        router.push('/login');
    };

    return (
        <>
            <div className="bg-card border border-border/50 rounded-xl p-5 space-y-5" data-admin-surface="">
                <h2 className="text-sm font-semibold">Account</h2>

                {/* Admin email — read-only */}
                <div className="space-y-1.5">
                    <Label htmlFor="admin-email">Email address</Label>
                    <Input
                        id="admin-email"
                        type="email"
                        value={email}
                        disabled
                        readOnly
                    />
                    <p className="text-xs text-muted-foreground">
                        Your login email. Contact your super admin to change it.
                    </p>
                </div>

                {/* Change password */}
                <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <div>
                        <p className="text-sm font-medium">Password</p>
                        <p className="text-xs text-muted-foreground">Update your account password</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChangePwOpen(true)}
                        id="change-password-btn"
                        className="flex items-center gap-1.5"
                    >
                        <KeyRound size={13} />
                        Change
                    </Button>
                </div>

                {/* Theme toggle */}
                <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <div>
                        <p className="text-sm font-medium">Appearance</p>
                        <p className="text-xs text-muted-foreground">Toggle light / dark mode</p>
                    </div>
                    <ThemeToggle />
                </div>

                {/* Logout */}
                <div className="pt-1">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleLogout}
                        id="admin-logout-btn"
                        className="flex items-center gap-1.5"
                    >
                        <LogOut size={13} />
                        Logout
                    </Button>
                </div>
            </div>

            <ChangePasswordModal open={changePwOpen} onOpenChange={setChangePwOpen} />
        </>
    );
}
