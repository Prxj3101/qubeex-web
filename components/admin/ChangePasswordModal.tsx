'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

const schema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Must contain at least one number'),
        confirmPassword: z.string().min(1, 'Please confirm your new password'),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
        path: ['confirmPassword'],
        message: 'Passwords do not match',
    });

type FormValues = z.infer<typeof schema>;

interface ChangePasswordModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function PasswordField({
    id,
    label,
    placeholder,
    error,
    registration,
}: {
    id: string;
    label: string;
    placeholder?: string;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registration: any;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <Input
                    id={id}
                    type={show ? 'text' : 'password'}
                    placeholder={placeholder}
                    className="pr-9"
                    aria-invalid={!!error}
                    {...registration}
                />
                <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                >
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema) });

    const onSubmit = async (data: FormValues) => {
        try {
            await api.post('/auth/change-password', {
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });
            toast.success('Password updated');
            reset();
            onOpenChange(false);
        } catch {
            toast.error('Failed to update password. Please check your current password.');
        }
    };

    const handleClose = (v: boolean) => {
        if (!v) reset();
        onOpenChange(v);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Change password</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
                    <PasswordField
                        id="currentPassword"
                        label="Current password"
                        placeholder="••••••••"
                        error={errors.currentPassword?.message}
                        registration={register('currentPassword')}
                    />
                    <PasswordField
                        id="newPassword"
                        label="New password"
                        placeholder="Min 8 chars, 1 uppercase, 1 number"
                        error={errors.newPassword?.message}
                        registration={register('newPassword')}
                    />
                    <PasswordField
                        id="confirmPassword"
                        label="Confirm new password"
                        placeholder="••••••••"
                        error={errors.confirmPassword?.message}
                        registration={register('confirmPassword')}
                    />
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting ? 'Updating…' : 'Update password'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
