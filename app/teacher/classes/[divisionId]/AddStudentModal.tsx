'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Camera, X, ChevronDown, BookOpen, Shield, MapPin, Users, Plus, Trash2, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

type AdmissionMatch = { childName: string; applicationNo: string; stage: string; admissionNo: string | null; placed: boolean; className: string; section: string | null };

const schema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    dob: z.string().optional(),
    religion: z.string().optional(),
    category: z.string().optional(),
    admissionDate: z.string().optional(),
    email: z.string().email('Enter a valid email').optional().or(z.literal('')),
    contactNo: z.string().optional(),
    bloodGroup: z.string().optional(),
    aadharNo: z.string().optional(),
    panNo: z.string().optional(),
    emergencyContact: z.string().optional(),
    rollNo: z.string().optional(),
    className: z.string().optional(),
    division: z.string().optional(),
    houseColor: z.string().optional(),
    studentId: z.string().optional(),
    password: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Guardian {
    name: string;
    number: string;
    relation: string;
}

export interface StudentFormData {
    name: string;
    dob?: string;
    gender?: string;
    religion?: string;
    category?: string;
    admissionDate?: string;
    email?: string;
    contactNo?: string;
    bloodGroup?: string;
    aadharNo?: string;
    panNo?: string;
    emergencyContact?: string;
    rollNo?: string;
    className?: string;
    division?: string;
    houseColor?: string;
    studentId?: string;
    password?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    guardians?: Guardian[];
}

interface AddStudentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    loading?: boolean;
    onSubmit: (data: StudentFormData) => void;
}

const COUNTRY_CODES = [
    { code: '+91', flag: '🇮🇳', country: 'IN' },
    { code: '+1', flag: '🇺🇸', country: 'US' },
    { code: '+44', flag: '🇬🇧', country: 'UK' },
    { code: '+61', flag: '🇦🇺', country: 'AU' },
    { code: '+971', flag: '🇦🇪', country: 'AE' },
];

const GENDERS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'];
const HOUSE_COLORS = [
    { value: 'RED', label: '🔴 Red' },
    { value: 'BLUE', label: '🔵 Blue' },
    { value: 'GREEN', label: '🟢 Green' },
    { value: 'YELLOW', label: '🟡 Yellow' },
    { value: 'WHITE', label: '⚪ White' },
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

function Dropdown({ value, options, placeholder, onChange }: {
    value: string;
    options: { value: string; label: string }[] | string[];
    placeholder: string;
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const normalized = (options as (string | { value: string; label: string })[]).map(o =>
        typeof o === 'string' ? { value: o, label: o } : o
    );
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="w-full h-8 px-3 rounded-md border border-input bg-background text-sm text-left flex items-center justify-between hover:bg-muted transition-all">
                <span className={value ? 'text-foreground' : 'text-muted-foreground text-sm'}>
                    {value ? normalized.find(o => o.value === value)?.label ?? value : placeholder}
                </span>
                <ChevronDown size={13} className="text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute top-9 left-0 z-50 w-full bg-card border border-border rounded-xl shadow-xl py-1 max-h-40 overflow-y-auto">
                    {normalized.map(o => (
                        <button key={o.value} type="button"
                            onClick={() => { onChange(o.value); setOpen(false); }}
                            className={`w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors ${value === o.value ? 'text-primary font-semibold' : 'text-foreground'}`}>
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function AddStudentModal({ open, onOpenChange, loading, onSubmit: onFormSubmit }: AddStudentModalProps) {
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [countryCode, setCountryCode] = useState('+91');
    const [showCCDropdown, setShowCCDropdown] = useState(false);
    const [selectedGender, setSelectedGender] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedBloodGroup, setSelectedBloodGroup] = useState('');
    const [selectedHouseColor, setSelectedHouseColor] = useState('');
    const [guardians, setGuardians] = useState<Guardian[]>([
        { name: '', number: '', relation: '' },
        { name: '', number: '', relation: '' },
    ]);
    const fileRef = useRef<HTMLInputElement>(null);
    const selectedCC = COUNTRY_CODES.find(c => c.code === countryCode) ?? COUNTRY_CODES[0];


    const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '', dob: '', religion: '', category: '',
            admissionDate: '', email: '', contactNo: '',
            bloodGroup: '', aadharNo: '', panNo: '', emergencyContact: '',
            rollNo: '', className: '', division: '', houseColor: '',
            studentId: '', password: '', address: '', city: '',
            state: '', pincode: '', country: '',
        },
    });

    const nameVal = watch('name');
    const dobVal = watch('dob');

    // Warn if this child is already coming through Admissions (the admin adds them to the class).
    const [admissionMatches, setAdmissionMatches] = useState<AdmissionMatch[]>([]);
    useEffect(() => {
        const name = (nameVal ?? '').trim();
        const controller = new AbortController();
        const t = setTimeout(() => {
            if (!open || name.length < 3) { setAdmissionMatches([]); return; }
            api.get('/admissions-check', { signal: controller.signal, params: { name, dob: dobVal || undefined } })
                .then(res => setAdmissionMatches(res.data.data ?? []))
                .catch(() => { if (!controller.signal.aborted) setAdmissionMatches([]); });
        }, 500);
        return () => { clearTimeout(t); controller.abort(); };
    }, [nameVal, dobVal, open]);
    const initials = nameVal?.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? '';

    useEffect(() => {
        if (open) {
            reset();
            setAvatarPreview(null);
            setSelectedGender('');
            setSelectedCategory('');
            setSelectedBloodGroup('');
            setSelectedHouseColor('');
            setGuardians([{ name: '', number: '', relation: '' }, { name: '', number: '', relation: '' }]);
            setShowCCDropdown(false);
        }
    }, [open, reset]);

    const handleClose = (v: boolean) => {
        if (!v) {
            reset();
            setAvatarPreview(null);
            setSelectedGender('');
            setSelectedCategory('');
            setSelectedBloodGroup('');
            setSelectedHouseColor('');
            setGuardians([{ name: '', number: '', relation: '' }, { name: '', number: '', relation: '' }]);
        }
        onOpenChange(v);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setAvatarPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const updateGuardian = (index: number, field: keyof Guardian, value: string) => {
        setGuardians(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
    };

    const addGuardian = () => {
        setGuardians(prev => [...prev, { name: '', number: '', relation: '' }]);
    };

    const removeGuardian = (index: number) => {
        if (guardians.length > 2) setGuardians(prev => prev.filter((_, i) => i !== index));
    };


    const handleFormSubmit = (data: FormValues) => {
        onFormSubmit({
            name: data.name,
            dob: data.dob || undefined,
            gender: selectedGender || undefined,
            religion: data.religion || undefined,
            category: selectedCategory || undefined,
            admissionDate: data.admissionDate || undefined,
            email: data.email || undefined,
            contactNo: data.contactNo ? `${countryCode} ${data.contactNo}` : undefined,
            bloodGroup: selectedBloodGroup || undefined,
            aadharNo: data.aadharNo || undefined,
            panNo: data.panNo || undefined,
            emergencyContact: data.emergencyContact || undefined,
            rollNo: data.rollNo || undefined,
            className: data.className || undefined,
            division: data.division || undefined,
            houseColor: selectedHouseColor || undefined,
            studentId: data.studentId || undefined,
            password: data.password || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            state: data.state || undefined,
            pincode: data.pincode || undefined,
            country: data.country || undefined,
            guardians: guardians.filter(g => g.name.trim()),
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="p-0 gap-0 bg-card flex flex-col mx-auto"
                style={{ width: '92vw', maxWidth: '820px', maxHeight: '85vh' }}
            >
                {/* Header */}
                <div className="px-6 pt-5 pb-3.5 border-b border-border/50 shrink-0">
                    <DialogTitle className="text-base font-semibold">Add Student</DialogTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Add a new student to this class division.
                    </p>
                </div>

                <form className="flex flex-col flex-1 min-h-0" onSubmit={handleSubmit(handleFormSubmit)}>
                    <div className="flex-1 overflow-y-auto min-h-0">

                        {/* ── ROW 1: Student Info + Academic Details ── */}
                        <div className="flex flex-col lg:flex-row border-b border-border/40">

                            {/* LEFT — Student Info */}
                            <div className="flex-1 px-6 py-5 border-r-0 lg:border-r border-b lg:border-b-0 border-border/40 min-w-0">
                                <SectionLabel icon={User} label="Student Info" />

                                {/* Avatar + Name */}
                                <div className="flex items-start gap-3 mb-4">
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
                                                <span className="text-base font-bold text-muted-foreground select-none group-hover:opacity-0 transition-opacity">{initials}</span>
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera size={16} className="text-primary" />
                                                </div>
                                            </>
                                        ) : (
                                            <Camera size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <FL>Full Name *</FL>
                                        <Input placeholder="e.g. Aarav Mehta" className="h-8 text-sm" {...register('name')} />
                                        {errors.name && <p className="text-xs text-destructive mt-0.5">{errors.name.message}</p>}
                                        {admissionMatches.length > 0 && (
                                            <div role="alert" className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                                                <p className="flex items-center gap-1 font-semibold"><AlertTriangle size={12} />Already in Admissions</p>
                                                {admissionMatches.map(m => (
                                                    <p key={m.applicationNo} className="mt-0.5">
                                                        {m.childName} ({m.className}) - {m.placed ? `already added to ${m.section ?? 'a class'}` : m.stage === 'ADMITTED' ? `admitted${m.admissionNo ? `, no. ${m.admissionNo}` : ''}. The admin will add them to the class.` : `application ${m.applicationNo} is in progress.`}
                                                    </p>
                                                ))}
                                                <p className="mt-0.5 opacity-80">Check before adding, so the child is not added twice.</p>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] text-primary hover:underline">Upload Photo</button>
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
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <FL>Date of Birth</FL>
                                            <Input type="date" className="h-8 text-sm" {...register('dob')} />
                                        </div>
                                        <div>
                                            <FL>Gender</FL>
                                            <Dropdown value={selectedGender} options={GENDERS} placeholder="Select" onChange={setSelectedGender} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <FL>Religion</FL>
                                            <Input placeholder="e.g. Hindu" className="h-8 text-sm" {...register('religion')} />
                                        </div>
                                        <div>
                                            <FL>Category</FL>
                                            <Dropdown value={selectedCategory} options={CATEGORIES} placeholder="Select" onChange={setSelectedCategory} />
                                        </div>
                                    </div>
                                    <div>
                                        <FL>Admission Date</FL>
                                        <Input type="date" className="h-8 text-sm" {...register('admissionDate')} />
                                    </div>
                                    <div>
                                        <FL>Email</FL>
                                        <Input placeholder="student@gmail.com" type="email" className="h-8 text-sm" {...register('email')} />
                                        {errors.email && <p className="text-xs text-destructive mt-0.5">{errors.email.message}</p>}
                                    </div>
                                    <div>
                                        <FL>Contact No</FL>
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
                                                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left ${cc.code === countryCode ? 'font-semibold text-primary' : 'text-foreground'}`}>
                                                                <span>{cc.flag}</span>
                                                                <span>{cc.code}</span>
                                                                <span className="text-[10px] text-muted-foreground ml-auto">{cc.country}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <Input placeholder="98765 43210" className="flex-1 h-8 text-sm" {...register('contactNo')} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — Academic Details */}
                            <div className="flex-1 px-6 py-5 min-w-0">
                                <SectionLabel icon={BookOpen} label="Academic Details" />
                                <div className="space-y-2.5">
                                    {/* Row 1 */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <FL>Class</FL>
                                            <Input placeholder="e.g. 10" className="h-8 text-sm" {...register('className')} />
                                        </div>
                                        <div>
                                            <FL>Division</FL>
                                            <Input placeholder="e.g. A" className="h-8 text-sm" {...register('division')} />
                                        </div>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <FL>Roll No</FL>
                                            <Input placeholder="e.g. 01" className="h-8 text-sm" {...register('rollNo')} />
                                        </div>
                                        <div>
                                            <FL>House Color</FL>
                                            <Input placeholder="e.g. Red" className="h-8 text-sm" {...register('houseColor')} />
                                        </div>
                                    </div>

                                    {/* Row 3 */}
                                    {/* Student ID — assigned by backend on creation */}
                                    <div>
                                        <FL>Student ID</FL>
                                        <div className="h-8 px-3 rounded-md border border-dashed border-border/60 bg-muted/20 flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground/60 italic">
                                                Assigned on save (e.g. SXHS-01S26-0001)
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/40">Auto generated</span>
                                        </div>
                                    </div>

                                    {/* Row 4 */}
                                    {/* Password field */}
                                    <div>
                                        <FL>Password</FL>
                                        <div className="h-8 px-3 rounded-md border border-dashed border-border/60 bg-muted/20 flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground/60 italic">
                                                Auto-generated — shown after saving
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/40">Auto generated</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── ROW 2: Medical & Identity + Address ── */}
                        <div className="flex flex-col lg:flex-row border-b border-border/40">

                            {/* LEFT — Medical & Identity */}
                            <div className="flex-1 px-6 py-5 border-r-0 lg:border-r border-b lg:border-b-0 border-border/40 min-w-0">
                                <SectionLabel icon={Shield} label="Medical & Identity" />
                                <div className="space-y-2.5">
                                    <div>
                                        <FL>Blood Group</FL>
                                        <Dropdown value={selectedBloodGroup} options={BLOOD_GROUPS} placeholder="Select" onChange={setSelectedBloodGroup} />
                                    </div>
                                    <div>
                                        <FL>Aadhar No</FL>
                                        <Input placeholder="XXXX XXXX XXXX" className="h-8 text-sm" {...register('aadharNo')} />
                                    </div>
                                    <div>
                                        <FL>PAN No</FL>
                                        <Input placeholder="ABCDE1234F" className="h-8 text-sm" {...register('panNo')} />
                                    </div>
                                    <div>
                                        <FL>Emergency Contact</FL>
                                        <Input placeholder="98765 43210" className="h-8 text-sm" {...register('emergencyContact')} />
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — Address */}
                            <div className="flex-1 px-6 py-5 min-w-0">
                                <SectionLabel icon={MapPin} label="Address" />
                                <div className="space-y-2.5">
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
                                            <FL>Pincode</FL>
                                            <Input placeholder="400001" className="h-8 text-sm" {...register('pincode')} />
                                        </div>
                                        <div>
                                            <FL>Country</FL>
                                            <Input placeholder="India" className="h-8 text-sm" {...register('country')} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── ROW 3: Parents/Guardian — full width ── */}
                        <div className="px-6 py-5">
                            <div className="flex items-center justify-between mb-3">
                                <SectionLabel icon={Users} label="Parents / Guardian" />
                                <button type="button" onClick={addGuardian}
                                    className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline -mt-3">
                                    <Plus size={11} /> Add another
                                </button>
                            </div>
                            <div className="space-y-3">
                                {guardians.map((g, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-end gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 relative" data-dashboard-surface="">
                                        <div className="flex-1">
                                            <FL>Name</FL>
                                            <Input value={g.name} onChange={e => updateGuardian(i, 'name', e.target.value)}
                                                placeholder="e.g. Rajesh Mehta" className="h-8 text-sm" />
                                        </div>
                                        <div className="flex-1">
                                            <FL>Number</FL>
                                            <Input value={g.number} onChange={e => updateGuardian(i, 'number', e.target.value)}
                                                placeholder="98765 43210" className="h-8 text-sm" />
                                        </div>
                                        <div className="flex-1">
                                            <FL>Relation</FL>
                                            <Input value={g.relation} onChange={e => updateGuardian(i, 'relation', e.target.value)}
                                                placeholder="e.g. Father" className="h-8 text-sm" />
                                        </div>
                                        <button type="button" onClick={() => removeGuardian(i)}
                                            className="w-8 h-8 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border border-border/50 transition-all shrink-0">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="border-t border-border/50 px-6 py-3.5 flex items-center justify-between bg-card shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="min-w-[130px] h-8 px-5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            {loading ? 'Adding...' : 'Add Student'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}