'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import api from '@/lib/api';

interface Due { id: string; kind: 'LATE' | 'LOST' | 'DAMAGED'; amountPaise: number }

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Library fines the school has chosen to collect through fees. Shows nothing when there are none. */
export default function LibraryDues() {
    const [dues, setDues] = useState<{ items: Due[]; totalPaise: number } | null>(null);

    useEffect(() => {
        let live = true;
        api.get('/student/library/dues')
            .then((res) => { if (live) setDues(res.data.data as { items: Due[]; totalPaise: number }); })
            .catch(() => { /* no library, or not set up: show nothing */ });
        return () => { live = false; };
    }, []);

    if (!dues || dues.items.length === 0) return null;
    return (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2 mt-4">
            <p className="text-sm font-bold flex items-center gap-1.5"><BookOpen size={14} /> Library dues</p>
            {dues.items.map((d) => (
                <p key={d.id} className="text-xs flex justify-between"><span>{d.kind.charAt(0) + d.kind.slice(1).toLowerCase()} fine</span><span className="font-semibold">{rupees(d.amountPaise)}</span></p>
            ))}
            <p className="text-sm font-semibold flex justify-between border-t border-border/60 pt-2"><span>Total due</span><span>{rupees(dues.totalPaise)}</span></p>
            <p className="text-[11px] text-muted-foreground">Pay this with your fees. The library marks it paid once received.</p>
        </div>
    );
}
