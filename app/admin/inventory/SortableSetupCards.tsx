'use client';
import { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';

interface RecordWithId { id: string; name: string }
export function SortableSetupCards<T extends RecordWithId>({ items, visible, revision, disabled, onChange, onRevisionChange, onBusyChange, onReload, children }: { items: T[]; visible: T[]; revision: number; disabled: boolean; onChange: (items: T[]) => void; onRevisionChange: (revision: number) => void; onBusyChange: (busy: boolean) => void; onReload: () => Promise<unknown>; children: (item: T) => React.ReactNode }) {
    const grid = useRef<HTMLDivElement>(null);
    const busy = useRef(false);
    const [saving, setSaving] = useState(false);
    const [dragged, setDragged] = useState<string | null>(null);
    const [target, setTarget] = useState<string | null>(null);
    const targetAt = (x: number, y: number) => {
        const card = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-category-card]');
        return card && grid.current?.contains(card) ? card.dataset.categoryCard ?? null : null;
    };
    const move = async (id: string, targetId: string | null) => {
        if (disabled || busy.current || !targetId || id === targetId) return;
        const from = visible.findIndex(row => row.id === id), to = visible.findIndex(row => row.id === targetId);
        if (from < 0 || to < 0) return;
        const ordered = [...visible];
        ordered.splice(to, 0, ordered.splice(from, 1)[0]);
        const shown = new Set(visible.map(row => row.id));
        let index = 0;
        const next = items.map(row => shown.has(row.id) ? ordered[index++] : row);
        busy.current = true; setSaving(true); onBusyChange(true); onChange(next);
        try {
            const res = await api.post('/admin/inventory/setup-order/categories', { ids: next.map(row => row.id), revision });
            onRevisionChange(res.data.orderRevision); toast.success('Order saved');
        } catch (error) {
            onChange(items); toast.error(getErrorMessage(error, 'Could not save card order')); await onReload();
        } finally { busy.current = false; setSaving(false); onBusyChange(false); }
    };
    return <div ref={grid} role="list" aria-busy={saving} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
        {visible.map((item, index) => <div key={item.id} data-category-card={item.id} role="listitem" className={`relative min-w-0 rounded-xl bg-card p-4 shadow-[0_0_10px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_10px_1px_rgba(0,0,0,0.28)] transition-colors ${dragged === item.id ? 'opacity-60 ring-2 ring-primary' : target === item.id ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
            <button type="button" disabled={disabled || saving} aria-label={`Reorder ${item.name}`} title="Drag to reorder. Use arrow keys to move." className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-grab active:cursor-grabbing disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ touchAction: 'none' }}
                onPointerDown={event => { if (disabled || saving || event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragged(item.id); }}
                onPointerMove={event => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    setTarget(targetAt(event.clientX, event.clientY));
                    const container = grid.current?.parentElement;
                    if (container) { const bounds = container.getBoundingClientRect(); if (event.clientY < bounds.top + 45) container.scrollBy({ top: -12 }); else if (event.clientY > bounds.bottom - 45) container.scrollBy({ top: 12 }); }
                }}
                onPointerUp={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const drop = targetAt(event.clientX, event.clientY); event.currentTarget.releasePointerCapture(event.pointerId); setDragged(null); setTarget(null); void move(item.id, drop); }}
                onPointerCancel={() => { setDragged(null); setTarget(null); }}
                onLostPointerCapture={() => { setDragged(null); setTarget(null); }}
                onKeyDown={event => {
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                    event.preventDefault();
                    const columns = grid.current ? getComputedStyle(grid.current).gridTemplateColumns.split(' ').length : 1;
                    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns;
                    void move(item.id, visible[index + step]?.id ?? null);
                }}><GripVertical size={15} /></button>
            {children(item)}
        </div>)}
    </div>;
}
