'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PrimaryButton, SecondaryButton, SmallButton, inputCls } from '@/app/admin/payroll/_components/ui';
import type { SchoolPoint } from './types';
import { TransportArt } from './TransportArt';

const SchoolPickerMap = dynamic(() => import('./SchoolPickerMap'), {
    ssr: false,
    loading: () => <div className="h-full grid place-items-center text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>,
});

interface Place { display_name: string; lat: string; lon: string }

// School location: where every route ends, shown on the admin map and to parents.
export default function SchoolCard({ school, onChanged }: { school: SchoolPoint | null; onChanged: () => void }) {
    const [open, setOpen] = useState(false);
    const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [saving, setSaving] = useState(false);
    const [q, setQ] = useState('');
    const [places, setPlaces] = useState<Place[]>([]);
    const [searching, setSearching] = useState(false);
    const [flyTo, setFlyTo] = useState(0);

    const start = () => { setPoint(school ? { lat: school.lat, lng: school.lng } : null); setPlaces([]); setQ(''); setOpen(true); };

    // free address search (OpenStreetMap Nominatim), only when the admin presses Search
    const search = async () => {
        const term = q.trim();
        if (term.length < 3) return;
        setSearching(true);
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(term)}`, { headers: { 'Accept-Language': 'en' } });
            const data: Place[] = await r.json();
            setPlaces(data);
            if (!data.length) toast.message('No place found. Try a nearby landmark, or click on the map.');
        } catch { toast.error('Search is not available right now. Click on the map instead.'); }
        finally { setSearching(false); }
    };

    const save = async () => {
        if (!point) { toast.error('Click on the map where the school is'); return; }
        setSaving(true);
        try {
            await api.put('/admin/transport/school', point);
            toast.success('School location saved');
            setOpen(false);
            onChanged();
        } catch (err) { toast.error(getErrorMessage(err, 'Could not save the location')); }
        finally { setSaving(false); }
    };

    return <>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)]" data-admin-surface="">
            <TransportArt kind="school" size={64} />
            <div className="min-w-0">
                <p className="text-sm font-semibold">School location</p>
                <p className="text-xs text-muted-foreground">{school ? `Set (${school.lat.toFixed(5)}, ${school.lng.toFixed(5)}). Every bus starts and ends its trips here.` : 'Not set yet. Set it once: every bus trip starts and ends at the school.'}</p>
            </div>
            <SmallButton className="ml-auto" onClick={start}><MapPin size={12} />{school ? 'Change' : 'Set on map'}</SmallButton>
        </div>

        <Dialog open={open} onOpenChange={o => { if (!o && !saving) setOpen(false); }}>
            <DialogContent className="sm:max-w-[90vw] w-[90vw] h-[86vh] grid-rows-[auto_auto_minmax(0,1fr)_auto] bg-card">
                <DialogHeader>
                    <DialogTitle>School location</DialogTitle>
                    <DialogDescription>Search the school&apos;s area, then click exactly on the school gate (or drag the pin).</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input className={`${inputCls} pl-8`} value={q} placeholder="e.g. Nallasopara West station" onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void search(); }} />
                        </div>
                        <SecondaryButton onClick={search} disabled={searching}>{searching && <Loader2 size={13} className="animate-spin" />}Search</SecondaryButton>
                    </div>
                    {places.length > 0 && <div className="max-h-32 overflow-y-auto visible-scrollbar rounded-xl border border-border/60 divide-y divide-border/50">
                        {places.map(p => (
                            <button key={`${p.lat},${p.lon}`} type="button" className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted/40"
                                onClick={() => { setPoint({ lat: Number(p.lat), lng: Number(p.lon) }); setFlyTo(n => n + 1); setPlaces([]); }}>
                                {p.display_name}
                            </button>
                        ))}
                    </div>}
                </div>
                <div className="min-h-0">
                    <SchoolPickerMap value={point} onChange={(lat, lng) => setPoint({ lat, lng })} flyTo={flyTo} />
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'No point chosen yet'}</p>
                    <div className="ml-auto flex gap-2">
                        <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>Cancel</SecondaryButton>
                        <PrimaryButton onClick={save} disabled={saving || !point}>{saving && <Loader2 size={13} className="animate-spin" />}Save location</PrimaryButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </>;
}
