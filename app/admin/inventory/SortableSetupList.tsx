'use client';
import { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls, type PanInfo } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';

interface RecordWithId { id: string; name: string }
function SortableRow<T extends RecordWithId>({ item, disabled, onStart, onEnd, onScroll, onMove, children }: { item: T; disabled: boolean; onStart: () => void; onEnd: () => void; onScroll: (info: PanInfo) => void; onMove: (direction: number) => void; children: React.ReactNode }) {
    const controls = useDragControls();
    return <Reorder.Item as="div" value={item} dragListener={false} dragControls={controls} dragMomentum={false} role="listitem" className="relative flex items-center gap-2 px-3 py-3 bg-card" whileDrag={{ zIndex: 10 }} onDragStart={onStart} onDragEnd={onEnd} onDrag={(_event, info) => onScroll(info)}>
        <button type="button" disabled={disabled} aria-label={`Reorder ${item.name}`} title="Drag to reorder. Use arrow keys to move." className="flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-grab active:cursor-grabbing disabled:opacity-40 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ touchAction: 'none' }} onPointerDown={event => { if (!disabled) controls.start(event); }} onKeyDown={event => { if (!disabled && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); onMove(event.key === 'ArrowUp' ? -1 : 1); } }}><GripVertical size={15} /></button>
        {children}
    </Reorder.Item>;
}

export function SortableSetupList<T extends RecordWithId>({ kind, items, visible, revision, disabled, onChange, onRevisionChange, onBusyChange, onReload, children }: { kind: 'categories' | 'units' | 'locations' | 'suppliers'; items: T[]; visible: T[]; revision: number; disabled: boolean; onChange: (items: T[]) => void; onRevisionChange: (revision: number) => void; onBusyChange: (busy: boolean) => void; onReload: () => Promise<unknown>; children: (item: T) => React.ReactNode }) {
    const [saving, setSaving] = useState(false);
    const latest = useRef(items);
    const before = useRef(items);
    const busy = useRef(false);
    const scroll = useRef<HTMLDivElement>(null);
    const scrollFrame = useRef<number | null>(null);
    const scrollSpeed = useRef(0);
    const scrollTick = useRef<FrameRequestCallback>(() => {});
    useEffect(() => {
        scrollTick.current = () => {
            scroll.current?.scrollBy({ top: scrollSpeed.current });
            scrollFrame.current = scrollSpeed.current ? requestAnimationFrame(scrollTick.current) : null;
        };
        return () => { if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current); };
    }, []);
    const stopScrolling = () => {
        scrollSpeed.current = 0;
        if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = null;
    };
    useEffect(() => { latest.current = items; }, [items]);
    const merge = (ordered: T[]) => {
        const shown = new Set(ordered.map(item => item.id));
        let index = 0;
        return latest.current.map(item => shown.has(item.id) ? ordered[index++] : item);
    };
    const persist = async (next: T[], previous: T[]) => {
        if (busy.current || next.every((item, index) => item.id === previous[index]?.id)) return;
        busy.current = true; setSaving(true); onBusyChange(true);
        try {
            const res = await api.post(`/admin/inventory/setup-order/${kind}`, { ids: next.map(item => item.id), revision });
            onRevisionChange(res.data.orderRevision); toast.success('Order saved');
        } catch (err) {
            onChange(previous); latest.current = previous;
            toast.error(getErrorMessage(err, 'Could not save list order')); await onReload();
        } finally { busy.current = false; setSaving(false); onBusyChange(false); }
    };
    const reorder = (ordered: T[]) => { if (disabled || busy.current) return; const next = merge(ordered); latest.current = next; onChange(next); };
    const move = (item: T, direction: number) => {
        const index = visible.findIndex(row => row.id === item.id), target = index + direction;
        if (target < 0 || target >= visible.length || disabled || busy.current) return;
        const previous = latest.current, ordered = [...visible];
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        const next = merge(ordered); latest.current = next; onChange(next); void persist(next, previous);
    };
    const autoScroll = (info: PanInfo) => {
        const container = scroll.current; if (!container) return;
        const bounds = container.getBoundingClientRect();
        scrollSpeed.current = info.point.y < bounds.top + 45 ? -8 : info.point.y > bounds.bottom - 45 ? 8 : 0;
        if (!scrollSpeed.current) stopScrolling();
        else if (scrollFrame.current === null) scrollFrame.current = requestAnimationFrame(scrollTick.current);
    };
    return <Reorder.Group as="div" axis="y" ref={scroll} layoutScroll values={visible} onReorder={reorder} role="list" aria-busy={saving} className="h-full overflow-y-auto overscroll-contain visible-scrollbar divide-y divide-border/50">
        {visible.map(item => <SortableRow key={item.id} item={item} disabled={disabled || saving} onStart={() => { before.current = latest.current; }} onEnd={() => { stopScrolling(); void persist(latest.current, before.current); }} onScroll={autoScroll} onMove={direction => move(item, direction)}>{children(item)}</SortableRow>)}
    </Reorder.Group>;
}
