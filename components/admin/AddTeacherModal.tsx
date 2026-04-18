'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Enter a valid email'),
    phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddTeacherModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    defaultValues?: { name: string; email: string; phone?: string };
    loading?: boolean;
    onSubmit: (data: { name: string; email: string; phone?: string }) => void;
}

export function AddTeacherModal({
    open,
    onOpenChange,
    mode,
    defaultValues,
    loading,
    onSubmit: onFormSubmit,
}: AddTeacherModalProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: defaultValues?.name ?? '',
            email: defaultValues?.email ?? '',
            phone: defaultValues?.phone ?? '',
        },
    });

    // Reset form when defaultValues change (switching between teachers)
    useEffect(() => {
        if (open) {
            reset({
                name: defaultValues?.name ?? '',
                email: defaultValues?.email ?? '',
                phone: defaultValues?.phone ?? '',
            });
        }
    }, [open, defaultValues, reset]);

    const handleClose = (v: boolean) => {
        if (!v) reset();
        onOpenChange(v);
    };

    const handleFormSubmit = (data: FormValues) => {
        onFormSubmit({
            name: data.name,
            email: data.email,
            phone: data.phone || undefined,
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Add Teacher' : 'Edit Teacher'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Add a new teacher to your institution. An invite will be sent to their email.'
                            : 'Update the teacher\'s details.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="teacher-name">Full name *</Label>
                        <Input
                            id="teacher-name"
                            placeholder="e.g. Ritu Sharma"
                            aria-invalid={!!errors.name}
                            {...register('name')}
                        />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="teacher-email">Email *</Label>
                        <Input
                            id="teacher-email"
                            type="email"
                            placeholder="ritu@school.edu.in"
                            disabled={mode === 'edit'}
                            aria-invalid={!!errors.email}
                            {...register('email')}
                        />
                        {errors.email && (
                            <p className="text-xs text-destructive">{errors.email.message}</p>
                        )}
                        {mode === 'edit' && (
                            <p className="text-[11px] text-muted-foreground">
                                Email cannot be changed after creation.
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="teacher-phone">Phone (optional)</Label>
                        <Input
                            id="teacher-phone"
                            type="tel"
                            placeholder="+91 98765 43210"
                            {...register('phone')}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading
                                ? mode === 'create'
                                    ? 'Adding…'
                                    : 'Saving…'
                                : mode === 'create'
                                  ? 'Add Teacher'
                                  : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
