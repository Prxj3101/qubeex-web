'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    label: string;
    name: string;
    childrenLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
    confirmLabel?: string;
    description?: string;
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    label,
    name,
    childrenLabel,
    loading,
    onConfirm,
    confirmLabel,
    description,
}: DeleteConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm bg-card">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center mb-2">
                        <TriangleAlert size={22} className="text-red-600 dark:text-red-400" />
                    </div>
                    <DialogTitle className="text-center">
                        {confirmLabel ?? 'Delete'} {label} &ldquo;{name}&rdquo;?
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {description ?? (childrenLabel
                            ? `This will remove all associated ${childrenLabel} and assignments. This action cannot be undone.`
                            : 'This action cannot be undone.')}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row gap-2 sm:justify-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 ${confirmLabel === 'Activate'
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                        id="confirm-delete-btn"
                    >
                        {loading ? 'Loading…' : confirmLabel ?? 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
