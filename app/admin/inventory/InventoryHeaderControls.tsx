'use client';
import { useId, useRef, useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Popover } from 'radix-ui';

export function InventorySearch({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const id = useId();
    const close = () => { setOpen(false); button.current?.focus(); };
    return <div className={`flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-border/50 transition-[width] duration-200 motion-reduce:transition-none ${open ? 'w-60 bg-white dark:bg-muted/50 focus-within:border-primary/50' : 'w-8 ' + (value ? 'bg-white text-primary dark:bg-primary dark:text-white' : 'bg-white dark:bg-muted/50 text-muted-foreground')}`}>
        <button ref={button} type="button" title="Search" aria-label={open ? 'Collapse search' : label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(previous => !previous)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"><Search size={14} /></button>
        {open && <><input id={id} autoFocus aria-label={label} value={value} maxLength={120} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }} placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground focus:outline-none" /><button type="button" title="Collapse search" aria-label="Collapse search" onClick={close} className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X size={12} /></button></>}
    </div>;
}

export function InventoryFilters({ activeCount = 0, children }: { activeCount?: number; children: React.ReactNode }) {
    return <Popover.Root><Popover.Trigger asChild><button type="button" title="Filters" aria-label={activeCount ? `Filters (${activeCount} active)` : 'Filters'} className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 transition-colors ${activeCount ? 'bg-white text-primary dark:bg-primary dark:text-white' : 'bg-white dark:bg-muted/50 text-muted-foreground dark:hover:bg-muted hover:text-foreground'}`}><Filter size={14} />{activeCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-white ring-2 ring-background">{activeCount}</span>}</button></Popover.Trigger>
        <Popover.Portal><Popover.Content align="end" sideOffset={8} collisionPadding={12} aria-label="Inventory filters" className="z-50 w-80 max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl focus:outline-none">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Filters</h2><Popover.Close asChild><button type="button" aria-label="Close filters" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button></Popover.Close></div>
            <div className="space-y-3">{children}</div>
        </Popover.Content></Popover.Portal>
    </Popover.Root>;
}
