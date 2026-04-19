'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Institution } from '@/types';
import { InstitutionDetailsForm } from '@/components/admin/InstitutionDetailsForm';
import { AccountCard } from '@/components/admin/AccountCard';
import { Skeleton } from '@/components/ui/skeleton';

// TODO: wire to API — replace with real institution data from /admin/overview or a dedicated endpoint
const MOCK_INSTITUTION: Institution = {
    id: 'inst-mock',
    name: 'Delhi Public School',
    email: 'contact@dps.edu',
    type: 'SCHOOL',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: '',
    phone: '+91 98765 43210',
    logoUrl: undefined,
};

export default function AdminSettingsPage() {
    const { user } = useAuthStore();
    const [institution, setInstitution] = useState<Institution | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchInstitution() {
            try {
                // Try to get institution data from the overview endpoint
                const res = await api.get('/admin/overview');
                if (!cancelled) {
                    const data = res.data?.data;
                    setInstitution({
                        ...MOCK_INSTITUTION,
                        id: data?.institution?.id ?? MOCK_INSTITUTION.id,
                        name: data?.institution?.name ?? MOCK_INSTITUTION.name,
                        type: data?.institution?.type ?? MOCK_INSTITUTION.type,
                        status: data?.institution?.status ?? MOCK_INSTITUTION.status,
                        logoUrl: data?.institution?.logoUrl,
                    });
                }
            } catch {
                if (!cancelled) setInstitution(MOCK_INSTITUTION);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchInstitution();
        return () => { cancelled = true; };
    }, []);

    if (loading || !institution) {
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

            <InstitutionDetailsForm
                initialName={institution.name}
                initialEmail={institution.email}
                initialPhone={institution.phone}
                initialLogoUrl={institution.logoUrl}
                institutionType={institution.type}
            />

            <AccountCard email={user?.email ?? ''} />
        </div>
    );
}
