'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Palette, Loader2, Upload, Lock, CheckCircle2, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface BrandingConfig {
    eligible: boolean;
    enabled: boolean;
    brandName: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    updatedAt: string | null;
}

const getErr = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
    ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    ?? fallback;

export function WhiteLabelConfig({ institutionId, planName }: { institutionId: string; planName: string }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingFavicon, setUploadingFavicon] = useState(false);

    const [eligible, setEligible] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [brandName, setBrandName] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await api.get(`/superadmin/institutions/${institutionId}/white-label`);
                if (!active) return;
                const c: BrandingConfig = res.data.data;
                setEligible(c.eligible);
                setEnabled(c.enabled);
                setBrandName(c.brandName ?? '');
                setLogoUrl(c.logoUrl);
                setFaviconUrl(c.faviconUrl);
            } catch {
                // non-blocking
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [institutionId]);

    const patch = async (body: Record<string, unknown>) => {
        const res = await api.patch(`/superadmin/institutions/${institutionId}/white-label`, body);
        return res.data.data as { enabled: boolean; brandName: string | null; logoUrl: string | null; faviconUrl: string | null };
    };

    const handleToggle = async () => {
        setSaving(true);
        try {
            const next = !enabled;
            const updated = await patch({ enabled: next });
            setEnabled(updated.enabled);
            toast.success(next ? 'White-labeling enabled' : 'White-labeling disabled — QubeEx branding restored');
        } catch (e) {
            toast.error(getErr(e, 'Failed to update white-labeling'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveName = async () => {
        setSaving(true);
        try {
            const trimmed = nameDraft.trim();
            await patch({ brandName: trimmed || null });
            setBrandName(trimmed);
            setEditingName(false);
            toast.success('Institution name saved');
        } catch (e) {
            toast.error(getErr(e, 'Failed to save institution name'));
        } finally {
            setSaving(false);
        }
    };

    const startEditingName = () => {
        setNameDraft(brandName);
        setEditingName(true);
    };

    const handleUpload = async (file: File, kind: 'logo' | 'favicon') => {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            toast.error('Only PNG, JPG, or WEBP images are allowed');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image must be 2 MB or smaller');
            return;
        }
        const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingFavicon;
        setUploading(true);
        try {
            const uploadRes = await api.post(
                `/superadmin/institutions/${institutionId}/white-label/${kind}`,
                file,
                { headers: { 'Content-Type': file.type } }
            );
            const url = kind === 'logo' ? uploadRes.data.data.logoUrl : uploadRes.data.data.faviconUrl;
            const updated = await patch(kind === 'logo' ? { logoUrl: url } : { faviconUrl: url });
            if (kind === 'logo') setLogoUrl(updated.logoUrl); else setFaviconUrl(updated.faviconUrl);
            toast.success(`${kind === 'logo' ? 'Logo' : 'Favicon'} updated`);
        } catch (e) {
            toast.error(getErr(e, `Failed to upload ${kind}`));
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-card border border-border/50 rounded-2xl p-5 flex items-center justify-center h-32">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <Palette size={15} className="text-muted-foreground" />
                    <h3 className="text-sm font-bold">White-Labeling</h3>
                </div>
                {enabled && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        <CheckCircle2 size={11} /> Active
                    </span>
                )}
            </div>

            {!eligible ? (
                <div className="mt-3 flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/40">
                    <Lock size={16} className="text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        White-labeling requires an active Pro plan. This institution is currently on{' '}
                        <span className="font-semibold">{planName}</span>
                        {planName !== 'PRO' ? ' — upgrade to Pro to unlock it.' : ' — its subscription must be active.'}
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-[11px] text-muted-foreground mb-4">
                        Replace QubeEx branding with this institution&apos;s own name and logo throughout the web and mobile app.
                        Disabling preserves this configuration so it can be restored instantly if re-enabled.
                    </p>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40 mb-4">
                        <div>
                            <p className="text-xs font-semibold">{enabled ? 'Enabled' : 'Disabled'}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {enabled ? 'Institution branding is live across the platform.' : 'QubeEx branding is shown.'}
                            </p>
                        </div>
                        <button
                            disabled={saving}
                            onClick={handleToggle}
                            className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${enabled
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 hover:opacity-80'
                                : 'text-white hover:opacity-90'}`}
                            style={enabled ? undefined : { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            {enabled ? 'Disable' : 'Enable'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">Institution Name</label>
                            {editingName ? (
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        value={nameDraft}
                                        onChange={(e) => setNameDraft(e.target.value)}
                                        placeholder="e.g. ABC College"
                                        className="flex-1 h-9 px-3 rounded-lg border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50"
                                    />
                                    <button
                                        disabled={saving}
                                        onClick={handleSaveName}
                                        className="h-9 px-4 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                                    >
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                                    </button>
                                    <button
                                        disabled={saving}
                                        onClick={() => setEditingName(false)}
                                        className="h-9 px-4 rounded-lg text-xs font-semibold border border-border hover:bg-muted transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between h-9 px-3 rounded-lg border border-border bg-muted/40">
                                    <span className={`text-sm ${brandName ? '' : 'text-muted-foreground italic'}`}>
                                        {brandName || 'Not set'}
                                    </span>
                                    <button
                                        onClick={startEditingName}
                                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                                    >
                                        <Pencil size={12} /> Edit
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-muted-foreground">Logo</label>
                                <button
                                    disabled={uploadingLogo}
                                    onClick={() => logoInputRef.current?.click()}
                                    className="w-full h-24 rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-all disabled:opacity-50"
                                >
                                    {uploadingLogo ? (
                                        <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                    ) : logoUrl ? (
                                        <Image src={logoUrl} alt="Logo" width={40} height={40} unoptimized style={{ height: 40, width: 'auto' }} className="rounded" />
                                    ) : (
                                        <>
                                            <Upload size={16} className="text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground">Upload logo</span>
                                        </>
                                    )}
                                </button>
                                <input
                                    ref={logoInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'logo'); e.target.value = ''; }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-muted-foreground">Favicon / App Icon</label>
                                <button
                                    disabled={uploadingFavicon}
                                    onClick={() => faviconInputRef.current?.click()}
                                    className="w-full h-24 rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-all disabled:opacity-50"
                                >
                                    {uploadingFavicon ? (
                                        <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                    ) : faviconUrl ? (
                                        <Image src={faviconUrl} alt="Favicon" width={32} height={32} unoptimized className="rounded" />
                                    ) : (
                                        <>
                                            <Upload size={16} className="text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground">Upload favicon</span>
                                        </>
                                    )}
                                </button>
                                <input
                                    ref={faviconInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'favicon'); e.target.value = ''; }}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
