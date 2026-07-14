'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { InstitutionType } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building2, Upload } from 'lucide-react';
import Image from 'next/image';

const schema = z.object({
    name: z.string().min(1, 'Institution name is required').max(100),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface InstitutionDetailsFormProps {
    initialName: string;
    initialEmail: string;
    initialPhone?: string;
    initialLogoUrl?: string;
    institutionType: InstitutionType;
}

export function InstitutionDetailsForm({
    initialName,
    initialEmail,
    initialPhone,
    initialLogoUrl,
    institutionType,
}: InstitutionDetailsFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: initialName, email: initialEmail, phone: initialPhone ?? '' },
    });

    const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl ?? null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const onSubmit = async (data: FormValues) => {
        try {
            // Upload logo first if a new file was selected
            if (logoFile) {
                const fd = new FormData();
                fd.append('logo', logoFile);
                await api.post('/admin/institution/logo', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }

            const res = await api.patch('/admin/institution', {
                name: data.name,
                email: data.email,
                phone: data.phone || undefined,
            });

            // Refresh form defaults from response if available
            const updated = res.data?.data;
            if (updated) {
                reset({
                    name: updated.name ?? data.name,
                    email: updated.email ?? data.email,
                    phone: updated.phone ?? data.phone,
                });
            }

            setLogoFile(null);
            toast.success('Institution updated');
        } catch {
            toast.error('Failed to update institution details.');
        }
    };

    const typeLabel =
        institutionType === 'SCHOOL'
            ? 'School'
            : institutionType === 'COLLEGE'
              ? 'College'
              : 'Coaching centre';

    return (
        <div className="bg-card border border-border/50 rounded-xl p-4 lg:p-5">
            <h2 className="text-sm font-semibold mb-4">Institution details</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Logo upload */}
                <div className="flex flex-wrap items-center gap-4">
                    <div
                        className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden cursor-pointer shrink-0"
                        onClick={() => fileRef.current?.click()}
                        role="button"
                        aria-label="Upload institution logo"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                    >
                        {logoPreview ? (
                            <Image
                                src={logoPreview}
                                alt="Logo preview"
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                                unoptimized
                            />
                        ) : (
                            <Building2 size={22} className="text-muted-foreground" />
                        )}
                    </div>
                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-1.5"
                        >
                            <Upload size={13} />
                            {logoPreview ? 'Change logo' : 'Upload logo'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2 MB</p>
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleLogoChange}
                        id="institution-logo-input"
                    />
                </div>

                {/* Type — read-only */}
                <div className="space-y-1.5">
                    <Label>Institution type</Label>
                    <Input value={typeLabel} disabled readOnly id="institution-type" />
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="institution-name">Name</Label>
                    <Input
                        id="institution-name"
                        placeholder="Institution name"
                        aria-invalid={!!errors.name}
                        {...register('name')}
                    />
                    {errors.name && (
                        <p className="text-xs text-destructive">{errors.name.message}</p>
                    )}
                </div>

                {/* Contact email */}
                <div className="space-y-1.5">
                    <Label htmlFor="institution-email">Contact email</Label>
                    <Input
                        id="institution-email"
                        type="email"
                        placeholder="contact@school.edu"
                        aria-invalid={!!errors.email}
                        {...register('email')}
                    />
                    {errors.email && (
                        <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                    <Label htmlFor="institution-phone">Phone (optional)</Label>
                    <Input
                        id="institution-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        {...register('phone')}
                    />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
            </form>
        </div>
    );
}
