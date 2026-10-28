'use client';

import * as React from 'react';
import { CircleHelp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfirmTone = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** danger = red (destructive), warning = amber (hard to undo / notifies people), info = brand colour. */
    tone?: ConfirmTone;
    icon?: LucideIcon;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

const TONES: Record<ConfirmTone, { tile: string; icon: string; button: string; Icon: LucideIcon }> = {
    danger: {
        tile: 'bg-red-100 dark:bg-red-950',
        icon: 'text-red-600 dark:text-red-400',
        button: 'bg-red-500 hover:bg-red-600 text-white',
        Icon: TriangleAlert,
    },
    warning: {
        tile: 'bg-amber-100 dark:bg-amber-950',
        icon: 'text-amber-600 dark:text-amber-400',
        button: 'bg-amber-500 hover:bg-amber-600 text-white',
        Icon: TriangleAlert,
    },
    info: {
        tile: 'bg-primary/10',
        icon: 'text-primary',
        button: '',
        Icon: CircleHelp,
    },
};

/**
 * QubeEx replacement for window.confirm. Mounted once in the root layout;
 * call `const confirm = useConfirm()` and `if (!(await confirm({...}))) return;`.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);
    // Kept after close so the content doesn't blank out during the exit animation.
    const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
    const resolver = React.useRef<((value: boolean) => void) | null>(null);

    const settle = React.useCallback((value: boolean) => {
        resolver.current?.(value);
        resolver.current = null;
        setOpen(false);
    }, []);

    const confirm = React.useCallback<ConfirmFn>((opts) => {
        resolver.current?.(false);
        setOptions(opts);
        setOpen(true);
        return new Promise<boolean>((resolve) => { resolver.current = resolve; });
    }, []);

    const tone = TONES[options?.tone ?? 'info'];
    const Icon = options?.icon ?? tone.Icon;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <Dialog open={open} onOpenChange={(next) => { if (!next) settle(false); }}>
                <DialogContent showCloseButton={false} className="sm:max-w-sm bg-card">
                    <DialogHeader>
                        <div className={cn('mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-2', tone.tile)}>
                            <Icon size={22} className={tone.icon} />
                        </div>
                        <DialogTitle className="text-center">{options?.title}</DialogTitle>
                        {options?.message && (
                            <DialogDescription className="text-center whitespace-pre-line">{options.message}</DialogDescription>
                        )}
                    </DialogHeader>
                    <DialogFooter className="flex-row gap-2 sm:justify-center">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => settle(false)}>
                            {options?.cancelLabel ?? 'Cancel'}
                        </Button>
                        <Button size="sm" className={cn('flex-1', tone.button)} onClick={() => settle(true)}>
                            {options?.confirmLabel ?? 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ConfirmContext.Provider>
    );
}

export function useConfirm(): ConfirmFn {
    const ctx = React.useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
    return ctx;
}
