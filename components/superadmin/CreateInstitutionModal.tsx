'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Institution } from '@/types';
import {
    Building2, GraduationCap, BookOpen, ChevronDown,
    User, MapPin, CreditCard, Layers, Camera, X,
} from 'lucide-react';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: (newInst?: Institution) => void;
}

const INST_TYPES = [
    { value: 'SCHOOL', label: 'School', icon: Building2, desc: 'K-12 & high schools' },
    { value: 'COLLEGE', label: 'College', icon: GraduationCap, desc: 'Degree & junior colleges' },
    { value: 'COACHING', label: 'Coaching', icon: BookOpen, desc: 'Coaching & test prep' },
] as const;

const PLANS = [
    { value: 'BASIC', label: 'Basic' },
    { value: 'PRO', label: 'Pro' },
    { value: 'TRIAL', label: 'Trial' },
] as const;

const COUNTRY_CODES = [
    { code: '+91', flag: '🇮🇳', country: 'IN' },
    { code: '+1', flag: '🇺🇸', country: 'US' },
    { code: '+44', flag: '🇬🇧', country: 'UK' },
    { code: '+61', flag: '🇦🇺', country: 'AU' },
    { code: '+971', flag: '🇦🇪', country: 'AE' },
    { code: '+65', flag: '🇸🇬', country: 'SG' },
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

export function CreateInstitutionModal({ open, onClose, onSuccess }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [countryCode, setCountryCode] = useState('+91');
    const [showCCDropdown, setShowCCDropdown] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        name: '', email: '', phone: '',
        type: 'SCHOOL' as 'SCHOOL' | 'COLLEGE' | 'COACHING',
        address: '', city: '', state: '', country: 'India', pincode: '',
        adminName: '', adminEmail: '',
        plan: 'BASIC' as 'BASIC' | 'PRO' | 'TRIAL',
        trialDays: '14',
        board: '', medium: '',
    });

    const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

    const initials = form.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            toast.error('Only PNG, JPG, or WEBP images are allowed');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo must be 2 MB or smaller');
            return;
        }

        setLogoFile(file);
        const reader = new FileReader();
        reader.onload = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleCreate = async () => {
        if (!form.name || !form.email || !form.adminEmail || !form.adminName) {
            toast.error('Please fill in all required fields');
            return;
        }
        const trialDays = Number(form.trialDays);
        if (form.plan === 'TRIAL' && (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365)) {
            toast.error('Trial duration must be between 1 and 365 days');
            return;
        }
        try {
            setLoading(true);
            let logoUrl: string | undefined;

            if (logoFile) {
                const uploadRes = await api.post('/superadmin/institutions/logo', logoFile, {
                    headers: { 'Content-Type': logoFile.type },
                });
                logoUrl = uploadRes.data?.data?.logoUrl;
            }

            const res = await api.post('/superadmin/institutions', {
                ...form,
                phone: form.phone ? `${countryCode} ${form.phone}` : undefined,
                logoUrl,
                plan: form.plan,
                trialDays: Number.isInteger(trialDays) ? trialDays : 14,
            });
            const newInst: Institution = res.data.data;
            toast.success('Institution created! Invite email sent 🚀');
            if (form.plan === 'TRIAL') {
                router.push(`/superadmin/institutions/${newInst.id}?tab=plan`);
                onClose();
                resetForm();
            } else {
                onSuccess(newInst);
                onClose();
                resetForm();
            }
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to create institution'));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({ name: '', email: '', phone: '', type: 'SCHOOL', address: '', city: '', state: '', country: 'India', pincode: '', adminName: '', adminEmail: '', plan: 'BASIC', trialDays: '14', board: '', medium: '' });
        setCountryCode('+91');
        setLogoPreview(null);
        setLogoFile(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    const selectedCC = COUNTRY_CODES.find(c => c.code === countryCode) ?? COUNTRY_CODES[0];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                className="p-0 gap-0 bg-card overflow-hidden"
                style={{ width: '85vw', maxWidth: '1050px', maxHeight: '85vh' }}
            >
                {/* ── Header ── */}
                <div className="px-6 pt-5 pb-3.5 border-b border-border/50">
                    <DialogTitle className="text-base font-semibold">Create New Institution</DialogTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Fields marked * are required.</p>
                </div>

                {/* ── Body: two columns side by side ── */}
                <div className="flex" style={{ height: 'calc(60vh - 130px)', overflow: 'hidden' }}>

                    {/* ─ LEFT ─ */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 border-r border-border/40 min-w-0">

                        {/* Type selector */}
                        <div>
                            <SectionLabel icon={Layers} label="Institution Type" />
                            <div className="grid grid-cols-3 gap-2">
                                {INST_TYPES.map(({ value, label, icon: Icon, desc }) => {
                                    const on = form.type === value;
                                    return (
                                        <button key={value} type="button" onClick={() => set('type', value)}
                                            className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all
                                                ${on ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50'}`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                                                ${on ? 'bg-primary text-white' : 'bg-background text-muted-foreground'}`}>
                                                <Icon size={15} />
                                            </div>
                                            <p className={`text-xs font-semibold ${on ? 'text-primary' : 'text-foreground'}`}>{label}</p>
                                            <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Institution info */}
                        <div>
                            <SectionLabel icon={Building2} label="Institution Info" />

                            {/* Logo */}
                            <div className="flex items-center gap-3 mb-4">
                                <div onClick={() => fileRef.current?.click()}
                                    className="w-14 h-14 rounded-xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all overflow-hidden relative group shrink-0">
                                    {logoPreview ? (
                                        <>
                                            <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
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
                                    <p className="text-xs font-medium">Institution Logo</p>
                                    <p className="text-[11px] text-muted-foreground">PNG, JPG up to 2MB</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] text-primary hover:underline">Upload</button>
                                        {logoPreview && (
                                            <>
                                                <span className="text-muted-foreground/40">·</span>
                                                <button type="button"
                                                    onClick={() => { setLogoPreview(null); setLogoFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                                                    className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5">
                                                    <X size={10} /> Remove
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                            </div>

                            <div className="space-y-2.5">
                                <div>
                                    <FL>Institution Name *</FL>
                                    <Input placeholder="e.g. Delhi Public School" value={form.name} onChange={e => set('name', e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div>
                                    <FL>Institute Email *</FL>
                                    <Input placeholder="admin@school.edu.in" value={form.email} onChange={e => set('email', e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div>
                                    <FL>Phone Number</FL>
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
                                                            <span>{cc.flag}</span><span>{cc.code}</span>
                                                            <span className="text-[10px] text-muted-foreground ml-auto">{cc.country}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <Input placeholder="98765 43210" value={form.phone} onChange={e => set('phone', e.target.value)} className="flex-1 h-8 text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <FL>Board</FL>
                                        <Input placeholder="CBSE / ICSE" value={form.board} onChange={e => set('board', e.target.value)} className="h-8 text-sm" />
                                    </div>
                                    <div>
                                        <FL>Medium</FL>
                                        <Input placeholder="English / Hindi" value={form.medium} onChange={e => set('medium', e.target.value)} className="h-8 text-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─ RIGHT ─ */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">

                        {/* Location */}
                        <div>
                            <SectionLabel icon={MapPin} label="Location" />
                            <div className="space-y-2.5">
                                <div>
                                    <FL>Address</FL>
                                    <Input placeholder="Street / Building / Area" value={form.address} onChange={e => set('address', e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><FL>City</FL><Input placeholder="Mumbai" value={form.city} onChange={e => set('city', e.target.value)} className="h-8 text-sm" /></div>
                                    <div><FL>State</FL><Input placeholder="Maharashtra" value={form.state} onChange={e => set('state', e.target.value)} className="h-8 text-sm" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><FL>Country</FL><Input placeholder="India" value={form.country} onChange={e => set('country', e.target.value)} className="h-8 text-sm" /></div>
                                    <div><FL>Pincode</FL><Input placeholder="400001" value={form.pincode} onChange={e => set('pincode', e.target.value)} className="h-8 text-sm" /></div>
                                </div>
                            </div>
                        </div>

                        {/* Admin */}
                        <div>
                            <SectionLabel icon={User} label="Admin Details" />
                            <div className="space-y-2.5">
                                <div>
                                    <FL>Admin Full Name *</FL>
                                    <Input placeholder="e.g. Rahul Sharma" value={form.adminName} onChange={e => set('adminName', e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div>
                                    <FL>Admin Email *</FL>
                                    <Input placeholder="rahul@school.edu.in" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} className="h-8 text-sm" />
                                </div>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
                                    An invite link will be sent to this email after creation.
                                </p>
                            </div>
                        </div>

                        {/* Plan */}
                        <div>
                            <SectionLabel icon={CreditCard} label="Subscription Plan" />
                            <div className="grid grid-cols-3 gap-2">
                                {PLANS.map(({ value, label }) => {
                                    const on = form.plan === value;
                                    const isPro = value === 'PRO';
                                    const isTrial = value === 'TRIAL';
                                    const activeColor = isPro ? '#DA7756' : isTrial ? '#F59E0B' : 'hsl(var(--primary))';
                                    const borderCls = on
                                        ? isPro
                                            ? 'border-[#DA7756] bg-[#DA7756]/8'
                                            : isTrial
                                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                                                : 'border-primary bg-primary/5'
                                        : 'border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50';
                                    return (
                                        <button key={`plan-${value}`} type="button" onClick={() => set('plan', value)}
                                            className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${borderCls}`}>
                                            <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                                                style={{ borderColor: on ? activeColor : 'hsl(var(--muted-foreground) / 0.4)' }}>
                                                {on && <div className="w-1.5 h-1.5 rounded-full" style={{ background: activeColor }} />}
                                            </div>
                                            <p className="text-sm font-semibold" style={{ color: on ? activeColor : undefined }}>{label}</p>
                                        </button>
                                    );
                                })}
                            </div>
                            {form.plan === 'TRIAL' && (
                                <div className="mt-3">
                                    <FL>Trial Duration *</FL>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={365}
                                        placeholder="14"
                                        value={form.trialDays}
                                        onChange={e => set('trialDays', e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Trial starts today · ends in {form.trialDays || '14'} days.
                                        Max 500 users, 10 GB storage, 2M AI tokens/month.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="border-t border-border/50 px-6 py-3.5 flex items-center justify-between bg-card">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
                    <button type="button" onClick={handleCreate} disabled={loading}
                        className="min-w-[150px] h-8 px-5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        {loading ? 'Creating...' : 'Create Institution'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
