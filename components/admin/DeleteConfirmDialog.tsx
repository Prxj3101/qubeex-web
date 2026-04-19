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
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    label,
    name,
    childrenLabel,
    loading,
    onConfirm,
}: DeleteConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center mb-2">
                        <TriangleAlert size={22} className="text-red-600 dark:text-red-400" />
                    </div>
                    <DialogTitle className="text-center">
                        Delete {label} &ldquo;{name}&rdquo;?
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {childrenLabel
                            ? `This will remove all associated ${childrenLabel} and assignments. This action cannot be undone.`
                            : 'This action cannot be undone.'}
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
                        variant="destructive"
                        size="sm"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1"
                        id="confirm-delete-btn"
                    >
                        {loading ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
