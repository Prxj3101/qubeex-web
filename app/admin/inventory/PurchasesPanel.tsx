'use client';
import { InventoryNavPills } from './InventoryNavPills';
import { useState } from 'react';
import { useInventoryNavigation } from './useInventoryNavigation';
import PurchaseRequestsPanel from './PurchaseRequestsPanel';
import PurchaseOrdersPanel from './PurchaseOrdersPanel';
import PurchasePipeline from './PurchasePipeline';
import OrderDraftDialog from './OrderDraftDialog';
import type { PurchaseLine } from './purchase-order.types';

export default function PurchasesPanel() {
    const [tab, setTab] = useInventoryNavigation<string>('purchaseTab', ['requests', 'orders'], 'requests');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [request, setRequest] = useState<{ id: string; requiredOn: string; lines: PurchaseLine[] } | null>(null);
    const [statsKey, setStatsKey] = useState(0);
    const go = (value: string) => { setSelectedOrderId(null); setTab(value); };
    const navigation = <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50 w-fit">{[{ value: 'requests', label: 'Requests' }, { value: 'orders', label: 'Orders' }].map(item => <button key={item.value} type="button" aria-pressed={tab === item.value} onClick={() => go(item.value)} className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${tab === item.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div>;
    // The progress strip is re-read every time the tab changes, so its numbers stay current.
    const banner = <PurchasePipeline key={`${tab}-${statsKey}`} onRequests={() => go('requests')} onOrders={() => go('orders')} />;
    return <><InventoryNavPills>{navigation}</InventoryNavPills>{tab === 'requests' ? <PurchaseRequestsPanel banner={banner} navigation={null} onCreateOrder={setRequest} onOrders={id => { setSelectedOrderId(id); setTab('orders'); }} /> : <PurchaseOrdersPanel banner={banner} initialOrderId={selectedOrderId} navigation={null} onRequests={() => setTab('requests')} />}{request && <OrderDraftDialog request={request} onClose={() => setRequest(null)} onSaved={() => { setRequest(null); setSelectedOrderId(null); setTab('orders'); setStatsKey(k => k + 1); }} />}</>;
}
