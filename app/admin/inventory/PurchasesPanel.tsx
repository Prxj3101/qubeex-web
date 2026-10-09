'use client';
import { useState } from 'react';
import PurchaseRequestsPanel from './PurchaseRequestsPanel';
import PurchaseOrdersPanel from './PurchaseOrdersPanel';
import OrderDraftDialog from './OrderDraftDialog';
import type { PurchaseLine } from './purchase-order.types';

export default function PurchasesPanel() {
    const [tab, setTab] = useState('requests');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [request, setRequest] = useState<{ id: string; requiredOn: string; lines: PurchaseLine[] } | null>(null);
    const navigation = <div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50 w-fit">{[{ value: 'requests', label: 'Requests' }, { value: 'orders', label: 'Orders' }].map(item => <button key={item.value} type="button" aria-pressed={tab === item.value} onClick={() => { setSelectedOrderId(null); setTab(item.value); }} className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${tab === item.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div>;
    return <>{tab === 'requests' ? <PurchaseRequestsPanel navigation={navigation} onCreateOrder={setRequest} onOrders={id => { setSelectedOrderId(id); setTab('orders'); }} /> : <PurchaseOrdersPanel initialOrderId={selectedOrderId} navigation={navigation} onRequests={() => setTab('requests')} />}{request && <OrderDraftDialog request={request} onClose={() => setRequest(null)} onSaved={() => { setRequest(null); setSelectedOrderId(null); setTab('orders'); }} />}</>;
}
