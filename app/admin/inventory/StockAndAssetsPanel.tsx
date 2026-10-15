'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { InventoryNavPills } from './InventoryNavPills';
import ItemsPanel from './ItemsPanel';
import ItemRequestsPanel from './ItemRequestsPanel';
import { useInventoryNavigation } from './useInventoryNavigation';

export default function StockAndAssetsPanel({ onSetup }: { onSetup: () => void }) {
 const [tab, setTab] = useInventoryNavigation<'items' | 'requests'>('stockTab', ['items', 'requests'], 'requests');
 const [pending, setPending] = useState(0);
 useEffect(() => {
  const controller = new AbortController();
  api.get('/admin/inventory/item-requests', { params: { page: 1 }, signal: controller.signal }).then(res => { if (!controller.signal.aborted) setPending(res.data.pendingCount); }).catch(() => {});
  return () => controller.abort();
 }, []);
 const navigation = <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">{(['requests', 'items'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{value === 'items' ? 'Stock' : 'Ledger'}{value === 'requests' && pending > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{pending}</span>}</button>)}</div>;
 return <><InventoryNavPills>{navigation}</InventoryNavPills>{tab === 'requests' ? <ItemRequestsPanel navigation={null} onPending={setPending} /> : <ItemsPanel onSetup={onSetup} />}</>;
}
