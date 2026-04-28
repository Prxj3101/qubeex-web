'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Phone, Mail, Camera, X, ChevronDown, GraduationCap } from 'lucide-react';

const schema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Enter a valid email'),
    phone: z.string().optional(),
    dob: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    qualification: z.string().optional(),
    experience: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
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

const COUNTRY_CODES = [
    { code: '+91', flag: '🇮🇳', country: 'IN' },
    { code: '+1', flag: '🇺🇸', country: 'US' },
    { code: '+44', flag: '🇬🇧', country: 'UK' },
    { code: '+61', flag: '🇦🇺', country: 'AU' },
    { code: '+971', flag: '🇦🇪', country: 'AE' },
];

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon size={11} className="text-primary" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{label}</p>
            <div className="flex-1 h-px bg-border/60" />
        </div>
    );
}

function FL({ children }: { children: React.ReactNode }) {
    return <p className="text-[11px] text-muted-foreground mb-1 font-medium">{children}</p>;
}

export function AddTeacherModal({
    open, onOpenChange, mode, defaultValues, loading, onSubmit: onFormSubmit,
}: AddTeacherModalProps) {
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [countryCode, setCountryCode] = useState('+91');
    const [showCCDropdown, setShowCCDropdown] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const selectedCC = COUNTRY_CODES.find(c => c.code === countryCode) ?? COUNTRY_CODES[0];

    const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: defaultValues?.name ?? '',
            email: defaultValues?.email ?? '',
            phone: defaultValues?.phone ?? '',
        },
    });

    const nameVal = watch('name');
    const initials = nameVal?.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? '';

    useEffect(() => {
        if (open) {
            reset({
                name: defaultValues?.name ?? '',
                email: defaultValues?.email ?? '',
                phone: defaultValues?.phone ?? '',
            });
            setAvatarPreview(null);
        }
    }, [open, defaultValues, reset]);

    const handleClose = (v: boolean) => {
        if (!v) { reset(); setAvatarPreview(null); }
        onOpenChange(v);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setAvatarPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleFormSubmit = (data: FormValues) => {
        onFormSubmit({
            name: data.name,
            email: data.email,
            phone: data.phone ? `${countryCode} ${data.phone}` : undefined,
        });
    };

    const [showGender, setShowGender] = useState(false);
    const [selectedGender, setSelectedGender] = useState('');

    const GENDERS = [
        { value: 'MALE', label: 'Male' },
        { value: 'FEMALE', label: 'Female' },
        { value: 'OTHER', label: 'Other' },
    ];

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="p-0 gap-0 bg-card overflow-hidden"
                style={{ width: '75vw', maxWidth: '820px', maxHeight: '85vh' }}
            >
                {/* Header */}
                <div className="px-6 pt-5 pb-3.5 border-b border-border/50">
                    <DialogTitle className="text-base font-semibold">
                        {mode === 'create' ? 'Add Teacher' : 'Edit Teacher'}
                    </DialogTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {mode === 'create'
                            ? 'Add a new teacher to your institution. An invite will be sent to their email.'
                            : 'Update the teacher\'s details.'}
                    </p>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit(handleFormSubmit)}>
                    <div className="flex" style={{ height: 'calc(55vh - 120px)', overflow: 'hidden' }}>

                        {/* LEFT */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 border-r border-border/40 min-w-0">
                            <div>
                                <SectionLabel icon={User} label="Teacher Info" />

                                {/* Avatar */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        onClick={() => fileRef.current?.click()}
                                        className="w-14 h-14 rounded-xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all overflow-hidden relative group shrink-0"
                                    >
                                        {avatarPreview ? (
                                            <>
                                                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera size={14} className="text-white" />
                                                </div>
                                            </>
                                        ) : initials ? (
                                            <>
                                                <span className="text-base font-bold text-muted-foreground select-none group-hover:opacity-0 transition-opacity">
                                                    {initials}
                                                </span>
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera size={16} className="text-primary" />
                                                </div>
                                            </>
                                        ) : (
                                            <Camera size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium">Profile Photo</p>
                                        <p className="text-[11px] text-muted-foreground">PNG, JPG up to 2MB</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] text-primary hover:underline">Upload</button>
                                            {avatarPreview && (
                                                <>
                                                    <span className="text-muted-foreground/40">·</span>
                                                    <button type="button" onClick={() => { setAvatarPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                                                        className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5">
                                                        <X size={10} /> Remove
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                                </div>

                                <div className="space-y-2.5">
                                    <div>
                                        <FL>Full Name *</FL>
                                        <Input placeholder="e.g. Ritu Sharma" className="h-8 text-sm" {...register('name')} />
                                        {errors.name && <p className="text-xs text-destructive mt-0.5">{errors.name.message}</p>}
                                    </div>


                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <FL>Date of Birth</FL>
                                            <Input type="date" className="h-8 text-sm" {...register('dob')} />
                                        </div>
                                        <div>
                                            <FL>Gender</FL>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowGender(v => !v)}
                                                    className="w-full h-8 px-3 rounded-md border border-input bg-background text-sm text-left flex items-center justify-between hover:bg-muted transition-all"
                                                >
                                                    <span className={selectedGender ? 'text-foreground' : 'text-muted-foreground'}>
                                                        {selectedGender ? GENDERS.find(g => g.value === selectedGender)?.label : 'Select'}
                                                    </span>
                                                    <ChevronDown size={13} className="text-muted-foreground" />
                                                </button>
                                                {showGender && (
                                                    <div className="absolute top-9 left-0 z-50 w-full bg-card border border-border rounded-xl shadow-xl py-1">
                                                        {GENDERS.map(g => (
                                                            <button
                                                                key={g.value}
                                                                type="button"
                                                                onClick={() => { setSelectedGender(g.value); setShowGender(false); }}
                                                                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors ${selectedGender === g.value ? 'text-primary font-semibold' : 'text-foreground'
                                                                    }`}
                                                            >
                                                                {g.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">
                            <div>
                                <SectionLabel icon={Mail} label="Contact Details" />
                                <div className="space-y-2.5">
                                    <div>
                                        <FL>Email *</FL>
                                        <Input
                                            placeholder="ritu@school.edu.in"
                                            type="email"
                                            disabled={mode === 'edit'}
                                            className="h-8 text-sm"
                                            {...register('email')}
                                        />
                                        {errors.email && <p className="text-xs text-destructive mt-0.5">{errors.email.message}</p>}
                                        {mode === 'edit' && (
                                            <p className="text-[11px] text-muted-foreground mt-0.5">Email cannot be changed after creation.</p>
                                        )}
                                    </div>

                                    {mode === 'create' && (
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
                                            An invite link will be sent to this email after adding.
                                        </p>
                                    )}

                                    <div>
                                        <FL>Phone (optional)</FL>
                                        <div className="flex gap-2">
                                            <div className="relative">
                                                <button type="button" onClick={() => setShowCCDropdown(v => !v)}
                                                    className="flex items-center gap-1 h-8 px-2.5 rounded-md border border-input bg-background text-xs hover:bg-muted transition-colors whitespace-nowrap">
                                                    <span>{selectedCC.flag}</span>
                                                    <span className="font-medium">{selectedCC.code}</span>
                                                    <ChevronDown size={11} className="text-muted-foreground" />
                                                </button>
                                                {showCCDropdown && (
                                                    <div className="absolute top-9 left-0 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]">
                                                        {COUNTRY_CODES.map(cc => (
                                                            <button key={cc.code} type="button"
                                                                onClick={() => { setCountryCode(cc.code); setShowCCDropdown(false); }}
                                                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left
                                                                    ${cc.code === countryCode ? 'font-semibold text-primary' : 'text-foreground'}`}>
                                                                <span>{cc.flag}</span>
                                                                <span>{cc.code}</span>
                                                                <span className="text-[10px] text-muted-foreground ml-auto">{cc.country}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <Input placeholder="98765 43210" className="flex-1 h-8 text-sm" {...register('phone')} />
                                        </div>
                                    </div>

                                    <div>
                                        <FL>Address</FL>
                                        <Input placeholder="Street / Area" className="h-8 text-sm" {...register('address')} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <FL>City</FL>
                                            <Input placeholder="Mumbai" className="h-8 text-sm" {...register('city')} />
                                        </div>
                                        <div>
                                            <FL>State</FL>
                                            <Input placeholder="Maharashtra" className="h-8 text-sm" {...register('state')} />
                                        </div>
                                        <div>
                                            <FL>Country</FL>
                                            <Input placeholder="India" className="h-8 text-sm" {...register('country')} />
                                        </div>
                                        <div>
                                            <FL>Pincode</FL>
                                            <Input placeholder="400001" className="h-8 text-sm" {...register('pincode')} />
                                        </div>
                                    </div>


                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Extra section — full width */}
                    <div className="px-6 py-4 border-t border-border/40">
                        <SectionLabel icon={GraduationCap} label="Professional Details" />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <FL>Qualification</FL>
                                <Input placeholder="e.g. B.Ed, M.A" className="h-8 text-sm" {...register('qualification')} />
                            </div>
                            <div>
                                <FL>Experience</FL>
                                <Input placeholder="e.g. 5 years" className="h-8 text-sm" {...register('experience')} />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border/50 px-6 py-3.5 flex items-center justify-between bg-card">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="min-w-[130px] h-8 px-5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            {loading
                                ? mode === 'create' ? 'Adding...' : 'Saving...'
                                : mode === 'create' ? 'Add Teacher' : 'Save Changes'
                            }
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}