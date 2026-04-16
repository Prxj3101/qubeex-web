'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const schema = z.object({
    password: z.string()
        .min(8, 'Min 8 characters')
        .regex(/[A-Z]/, 'Must have uppercase')
        .regex(/[0-9]/, 'Must have number')
        .regex(/[^A-Za-z0-9]/, 'Must have special character'),
    confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

function AcceptInviteForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [verifying, setVerifying] = useState(true);
    const [inviteInfo, setInviteInfo] = useState<{ email: string; institutionName: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [success, setSuccess] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    useEffect(() => {
        if (!token) { router.push('/login'); return; }
        const verify = async () => {
            try {
                const res = await api.get(`/auth/invite/verify?token=${token}`);
                setInviteInfo(res.data.data);
            } catch {
                toast.error('Invalid or expired invite link');
                router.push('/login');
            } finally {
                setVerifying(false);
            }
        };
        verify();
    }, [token]);

    const onSubmit = async (data: FormData) => {
        try {
            await api.post('/auth/invite/accept', { token, password: data.password });
            setSuccess(true);
            setTimeout(() => router.push('/login'), 2000);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to accept invite');
        }
    };

    if (verifying) return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="animate-spin" size={32} />
        </div>
    );

    if (success) return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-full max-w-md text-center">
                <CardContent className="pt-8 pb-8 space-y-4">
                    <CheckCircle size={48} className="text-green-500 mx-auto" />
                    <p className="text-xl font-bold">Account Activated!</p>
                    <p className="text-muted-foreground text-sm">Redirecting to login...</p>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center gap-2">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">Q</div>
                    <CardTitle>Accept Invite</CardTitle>
                    <CardDescription>
                        {inviteInfo && (
                            <span>Setting up account for <strong>{inviteInfo.email}</strong> at <strong>{inviteInfo.institutionName}</strong></span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-1">
                            <Label>Password</Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    {...register('password')}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label>Confirm Password</Label>
                            <div className="relative">
                                <Input
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    {...register('confirmPassword')}
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                        </div>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 size={14} className="animate-spin mr-2" />Setting up...</> : 'Activate Account'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" size={32} /></div>}>
            <AcceptInviteForm />
        </Suspense>
    );
}