'use client';

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
    code: z.string().max(20).optional(),
    capacity: z.coerce.number().int().positive().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface StructureItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** e.g. "Standard", "Subject", "Division" */
    label: string;
    /** 'create' or 'edit' */
    mode: 'create' | 'edit';
    /** Show capacity field (Level 3 only) */
    showCapacity?: boolean;
    /** Pre-populated values for edit mode */
    defaultValues?: { name: string; code?: string; capacity?: number };
    loading?: boolean;
    onSubmit: (data: { name: string; code?: string; capacity?: number }) => void;
}

export function StructureItemModal({
    open,
    onOpenChange,
    label,
    mode,
    showCapacity = false,
    defaultValues,
    loading,
    onSubmit: onFormSubmit,
}: StructureItemModalProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: defaultValues?.name ?? '',
            code: defaultValues?.code ?? '',
            capacity: defaultValues?.capacity ?? '',
        },
    });

    const handleClose = (v: boolean) => {
        if (!v) reset();
        onOpenChange(v);
    };

    const handleFormSubmit = (data: FormValues) => {
        onFormSubmit({
            name: data.name,
            code: data.code || undefined,
            capacity: typeof data.capacity === 'number' ? data.capacity : undefined,
        });
    };

    const title = mode === 'create' ? `Add ${label}` : `Edit ${label}`;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? `Create a new ${label.toLowerCase()} in your institution.`
                            : `Update the ${label.toLowerCase()} details.`}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="structure-name">{label} name *</Label>
                        <Input
                            id="structure-name"
                            placeholder={`e.g. ${label === 'Standard' ? 'Class 10' : label === 'Subject' ? 'Mathematics' : label === 'Division' ? '10-A' : label === 'Course' ? 'B.Tech' : label === 'Stream' ? 'Computer Science' : label === 'Batch' ? 'Morning Batch' : label}`}
                            aria-invalid={!!errors.name}
                            {...register('name')}
                        />
                        {errors.name && (
                            <p className="text-xs text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="structure-code">Code (optional)</Label>
                        <Input
                            id="structure-code"
                            placeholder="e.g. 10, BTECH, CS"
                            {...register('code')}
                        />
                    </div>

                    {showCapacity && (
                        <div className="space-y-1.5">
                            <Label htmlFor="structure-capacity">Capacity (optional)</Label>
                            <Input
                                id="structure-capacity"
                                type="number"
                                placeholder="Max students"
                                min={1}
                                {...register('capacity')}
                            />
                            {errors.capacity && (
                                <p className="text-xs text-destructive">{errors.capacity.message}</p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading
                                ? mode === 'create'
                                    ? 'Creating…'
                                    : 'Saving…'
                                : mode === 'create'
                                  ? `Add ${label}`
                                  : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
