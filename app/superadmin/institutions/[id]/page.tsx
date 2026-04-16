'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Calendar, ToggleLeft, ToggleRight, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Institution } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function InstitutionDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [institution, setInstitution] = useState<Institution | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchInstitution = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/superadmin/institutions/${id}`);
            setInstitution(res.data.data);
        } catch {
            toast.error('Failed to fetch institution');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInstitution(); }, [id]);

    const handleStatusToggle = async () => {
        if (!institution) return;
        const newStatus = institution.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        try {
            await api.patch(`/superadmin/institutions/${id}/status`, { status: newStatus });
            toast.success(`Institution ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
            fetchInstitution();
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleResendInvite = async () => {
        if (!institution) return;
        const adminEmail = institution.users?.[0]?.email ?? '';
        try {
            await api.post(`/superadmin/institutions/${id}/resend-invite`, { email: adminEmail });
            toast.success('Invite resent successfully');
        } catch {
            toast.error('Failed to resend invite');
        }
    };

    if (loading) return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
        </div>
    );

    if (!institution) return (
        <div className="text-center py-20 text-muted-foreground">
            Institution not found
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Back button + header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft size={16} />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{institution.name}</h1>
                    <p className="text-muted-foreground text-sm">Institution Details</p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" onClick={handleResendInvite}>
                        <Send size={14} className="mr-2" /> Resend Invite
                    </Button>
                    <Button
                        variant={institution.status === 'ACTIVE' ? 'destructive' : 'default'}
                        onClick={handleStatusToggle}
                    >
                        {institution.status === 'ACTIVE'
                            ? <><ToggleLeft size={14} className="mr-2" />Suspend</>
                            : <><ToggleRight size={14} className="mr-2" />Activate</>
                        }
                    </Button>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-muted-foreground">Institution Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-muted-foreground" />
                            <span className="text-sm">{institution.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Mail size={14} className="text-muted-foreground" />
                            <span className="text-sm">{institution.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-muted-foreground" />
                            <span className="text-sm">{new Date(institution.createdAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">{institution.type}</Badge>
                            <Badge variant={institution.status === 'ACTIVE' ? 'default' : 'destructive'}>
                                {institution.status}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm text-muted-foreground">Admin Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {institution.users && institution.users.length > 0 ? (
                            institution.users.map((user) => (
                                <div key={user.id} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Mail size={14} className="text-muted-foreground" />
                                        <span className="text-sm">{user.email}</span>
                                    </div>
                                    <Badge variant="outline">{user.role}</Badge>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No admin assigned yet</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}