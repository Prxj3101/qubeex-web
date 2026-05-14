'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Institution } from '@/types';
import { InstitutionDetailsForm } from '@/components/admin/InstitutionDetailsForm';
import { AccountCard } from '@/components/admin/AccountCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminSettingsPage() {
    const { user } = useAuthStore();
    const [institution, setInstitution] = useState<Institution | null>(null);
    const [loading, setLoading] = useState(true);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        api.get('/admin/me')
            .then(res => {
                const d = res.data?.data;
                if (d) setInstitution(d as Institution);
            })
            .catch(() => { /* show nothing — form stays empty with error state */ })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4 py-6">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4 py-6 px-2">
            <div>
                <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                    Settings
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Manage your institution and account preferences.
                </p>
            </div>

            {institution ? (
                <InstitutionDetailsForm
                    initialName={institution.name}
                    initialEmail={institution.email}
                    initialPhone={institution.phone}
                    initialLogoUrl={institution.logoUrl}
                    institutionType={institution.type}
                />
            ) : (
                <div className="bg-card border border-border/50 rounded-xl p-5 text-sm text-muted-foreground">
                    Could not load institution details. Please refresh the page.
                </div>
            )}

            <AccountCard email={user?.email ?? ''} />
        </div>
    );
}
