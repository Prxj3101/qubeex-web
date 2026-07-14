'use client';

import type { Teacher } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Link2, UserX, UserCheck } from 'lucide-react';

interface TeacherTableProps {
    teachers: Teacher[];
    loading: boolean;
    onEdit: (teacher: Teacher) => void;
    onAssign: (teacher: Teacher) => void;
    onToggleStatus: (teacher: Teacher) => void;
}

export function TeacherTable({
    teachers,
    loading,
    onEdit,
    onAssign,
    onToggleStatus,
}: TeacherTableProps) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (teachers.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <p className="text-base font-medium">No teachers yet</p>
                <p className="text-sm mt-1">Add your first teacher to get started.</p>
            </div>
        );
    }

    return (
        <div className="border border-border/50 rounded-xl overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignments</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {teachers.map((t) => {
                        const classTeacher = t.assignments.find(
                            (a) => a.role === 'CLASS_TEACHER',
                        );
                        return (
                            <TableRow key={t.id}>
                                <TableCell>
                                    <div>
                                        <p className="font-medium text-sm">{t.name}</p>
                                        {classTeacher && (
                                            <p className="text-[11px] text-primary mt-0.5">
                                                Class Teacher — {classTeacher.level3Name}
                                            </p>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {t.email}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {t.phone || '—'}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={t.status === 'ACTIVE' ? 'default' : 'secondary'}
                                    >
                                        {t.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm">
                                        {t.assignments.length}{' '}
                                        <span className="text-muted-foreground text-xs">
                                            {t.assignments.length === 1
                                                ? 'assignment'
                                                : 'assignments'}
                                        </span>
                                    </span>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {new Date(t.joinedAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <MoreHorizontal size={14} />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuItem onClick={() => onEdit(t)}>
                                                <Pencil size={13} className="mr-2" />
                                                Edit details
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onAssign(t)}>
                                                <Link2 size={13} className="mr-2" />
                                                Manage assignments
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => onToggleStatus(t)}
                                                variant={t.status === 'ACTIVE' ? 'destructive' : undefined}
                                            >
                                                {t.status === 'ACTIVE' ? (
                                                    <>
                                                        <UserX size={13} className="mr-2" />
                                                        Deactivate
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserCheck size={13} className="mr-2" />
                                                        Activate
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
