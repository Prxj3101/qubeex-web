'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AuditLog } from '@/types';
import api from '@/lib/api';
import { toast } from 'sonner';

const ACTION_COLOR: Record<string, string> = {
    INSTITUTION_CREATED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    INSTITUTION_STATUS_CHANGED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    INVITE_ACCEPTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    LOGIN_SUCCESS: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    LOGIN_FAILED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/audit-logs');
            setLogs(res.data.data);
        } catch {
            toast.error('Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Audit Logs</h1>
                    <p className="text-muted-foreground text-sm">Track all system activities</p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchLogs}>
                    <RefreshCw size={16} />
                </Button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <p className="text-lg font-medium">No logs yet</p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Institution</TableHead>
                                <TableHead>Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_COLOR[log.action] ?? 'bg-muted text-muted-foreground'}`}>
                                            {log.action.replace(/_/g, ' ')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {log.user?.email ?? log.userId}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {log.institutionId ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(log.createdAt).toLocaleString('en-IN')}
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