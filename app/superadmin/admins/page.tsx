'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Mail, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Admin {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    institution?: {
        name: string;
        type: string;
        status: string;
    };
}

export default function AdminsPage() {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/institutions');
            // Extract admins from all institutions
            const allAdmins = res.data.data.flatMap((inst: any) =>
                (inst.users ?? []).map((user: any) => ({
                    ...user,
                    institution: { name: inst.name, type: inst.type, status: inst.status },
                }))
            );
            setAdmins(allAdmins);
        } catch {
            toast.error('Failed to fetch admins');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAdmins(); }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Admins</h1>
                    <p className="text-muted-foreground text-sm">All institution admins</p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchAdmins}>
                    <RefreshCw size={16} />
                </Button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : admins.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <p className="text-lg font-medium">No admins yet</p>
                    <p className="text-sm">Create an institution to invite an admin</p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Admin</TableHead>
                                <TableHead>Institution</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Inst. Status</TableHead>
                                <TableHead>Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {admins.map((admin) => (
                                <TableRow key={admin.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                                    {admin.email[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium">{admin.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} className="text-muted-foreground" />
                                            <span className="text-sm">{admin.institution?.name ?? '—'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{admin.institution?.type ?? '—'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={admin.institution?.status === 'ACTIVE' ? 'default' : 'destructive'}>
                                            {admin.institution?.status ?? '—'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(admin.createdAt).toLocaleDateString('en-IN')}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}