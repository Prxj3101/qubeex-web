'use client';

import { Institution } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal, Eye, ToggleLeft, ToggleRight, Send } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Props {
    institutions: Institution[];
    loading: boolean;
    onRefresh: () => void;
}

export function InstitutionTable({ institutions, loading, onRefresh }: Props) {
    const router = useRouter();

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        try {
            await api.patch(`/superadmin/institutions/${id}/status`, { status: newStatus });
            toast.success(`Institution ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
            onRefresh();
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleResendInvite = async (id: string, email: string) => {
        try {
            await api.post(`/superadmin/institutions/${id}/resend-invite`, { email });
            toast.success('Invite resent successfully');
        } catch {
            toast.error('Failed to resend invite');
        }
    };

    if (loading) return (
        <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
    );

    if (institutions.length === 0) return (
        <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No institutions yet</p>
            <p className="text-sm">Create your first institution to get started</p>
        </div>
    );

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {institutions.map((inst) => (
                        <TableRow key={inst.id}>
                            <TableCell className="font-medium">{inst.name}</TableCell>
                            <TableCell className="text-muted-foreground">{inst.email}</TableCell>
                            <TableCell><Badge variant="outline">{inst.type}</Badge></TableCell>
                            <TableCell>
                                <Badge variant={inst.status === 'ACTIVE' ? 'default' : 'destructive'}>
                                    {inst.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                                {new Date(inst.createdAt).toLocaleDateString('en-IN')}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => router.push(`/superadmin/institutions/${inst.id}`)}>
                                            <Eye size={14} className="mr-2" /> View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatusToggle(inst.id, inst.status)}>
                                            {inst.status === 'ACTIVE'
                                                ? <><ToggleLeft size={14} className="mr-2" />Suspend</>
                                                : <><ToggleRight size={14} className="mr-2" />Activate</>
                                            }
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleResendInvite(inst.id, inst.users?.[0]?.email ?? '')}>
                                            <Send size={14} className="mr-2" /> Resend Invite
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}