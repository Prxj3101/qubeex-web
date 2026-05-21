'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { ChangePasswordModal } from '@/components/admin/ChangePasswordModal';
import {
    UserCircle2,
    Mail,
    KeyRound,
    Palette,
    Shield,
    Building2,
} from 'lucide-react';

// ─── schema ────────────────────────────────────────────────────────────────
const nameSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});
type NameForm = z.infer<typeof nameSchema>;

// ─── Page ──────────────────────────────────────────────────────────────────
export default function AdminProfilePage() {
    const { user, setAuth, token } = useAuthStore();
    const [institution, setInstitution] = useState<{
        name: string;
        type: string;
        logoUrl?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [changePwOpen, setChangePwOpen] = useState(false);
    const fetchedRef = useRef(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<NameForm>({
        resolver: zodResolver(nameSchema),
        defaultValues: { name: user?.name ?? '' },
    });

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        api.get('/admin/me')
            .then((res) => {
                const d = res.data?.data;
                if (d) {
                    setInstitution({
                        name: d.name,
                        type: d.type,
                        logoUrl: d.logoUrl,
                    });
                }
            })
            .catch(() => { /* non-critical */ })
            .finally(() => setLoading(false));
    }, []);

    // Sync name field when store loads
    useEffect(() => {
        if (user?.name) reset({ name: user.name });
    }, [user?.name, reset]);

    const onSaveName = async (data: NameForm) => {
        try {
            await api.patch('/auth/profile', { name: data.name });
            // Optimistically update the auth store
            if (user && token) {
                setAuth({ ...user, name: data.name }, token);
            }
            reset({ name: data.name });
            toast.success('Display name updated');
        } catch {
            toast.error('Failed to update name');
        }
    };

    const typeLabel =
        institution?.type === 'SCHOOL'
            ? 'School'
            : institution?.type === 'COLLEGE'
                ? 'College'
                : institution?.type === 'COACHING'
                    ? 'Coaching centre'
                    : '—';

    const initials = (user?.name ?? user?.email ?? 'A')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4 py-6 px-2">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-52 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4 py-6 px-2">
            {/* ── Page header ──────────────────────────────────────── */}
            <div>
                <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                    My Profile
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Manage your personal account details and preferences.
                </p>
            </div>

            {/* ── Avatar + identity card ───────────────────────────── */}
            <div className="bg-card border border-border/50 rounded-xl p-5 space-y-5">
                <h2 className="text-sm font-semibold">Account details</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-[#7C3AED]/25 flex items-center justify-center shrink-0 ring-2 ring-border">
                        <span className="text-xl font-bold text-violet-700 dark:text-violet-300">
                            {initials}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{user?.name || user?.email || 'Admin'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Shield size={11} className="text-violet-500" />
                            <p className="text-xs text-muted-foreground">Administrator</p>
                        </div>
                    </div>
                </div>

                {/* Display name form */}
                <form onSubmit={handleSubmit(onSaveName)} className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="profile-name">
                            <span className="flex items-center gap-1.5">
                                <UserCircle2 size={13} className="text-muted-foreground" />
                                Display name
                            </span>
                        </Label>
                        <Input
                            id="profile-name"
                            placeholder="Your name"
                            aria-invalid={!!errors.name}
                            {...register('name')}
                        />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Email — read-only */}
                    <div className="space-y-1.5">
                        <Label htmlFor="profile-email">
                            <span className="flex items-center gap-1.5">
                                <Mail size={13} className="text-muted-foreground" />
                                Email address
                            </span>
                        </Label>
                        <Input
                            id="profile-email"
                            type="email"
                            value={user?.email ?? ''}
                            disabled
                            readOnly
                        />
                        <p className="text-xs text-muted-foreground">
                            Contact your super admin to change your login email.
                        </p>
                    </div>

                    <Button
                        type="submit"
                        disabled={isSubmitting || !isDirty}
                        className="w-full sm:w-auto"
                        size="sm"
                    >
                        {isSubmitting ? 'Saving…' : 'Save name'}
                    </Button>
                </form>
            </div>

            {/* ── Institution badge ────────────────────────────────── */}
            {institution && (
                <div className="bg-card border border-border/50 rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold">Institution</h2>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border/50">
                            <Building2 size={16} className="text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">{institution.name}</p>
                            <p className="text-xs text-muted-foreground">{typeLabel}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Security + Appearance ────────────────────────────── */}
            <div className="bg-card border border-border/50 rounded-xl p-5 space-y-1">
                <h2 className="text-sm font-semibold mb-3">Security & Preferences</h2>

                {/* Change password */}
                <div className="flex items-center justify-between py-2.5 border-b border-border/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                            <KeyRound size={14} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Password</p>
                            <p className="text-xs text-muted-foreground">Update your account password</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChangePwOpen(true)}
                        id="profile-change-password-btn"
                        className="flex items-center gap-1.5 shrink-0"
                    >
                        <KeyRound size={12} />
                        Change
                    </Button>
                </div>

                {/* Appearance */}
                <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                            <Palette size={14} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Appearance</p>
                            <p className="text-xs text-muted-foreground">Toggle light / dark mode</p>
                        </div>
                    </div>
                    <ThemeToggle />
                </div>
            </div>

            <ChangePasswordModal open={changePwOpen} onOpenChange={setChangePwOpen} />
        </div>
    );
}
