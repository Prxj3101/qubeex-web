'use client';

import PurchasesPanel from './PurchasesPanel';
import CategoriesPanel from './CategoriesPanel';
import UnitsPanel from './UnitsPanel';
import LocationsPanel from './LocationsPanel';
import SuppliersPanel from './SuppliersPanel';
import ItemsPanel from './ItemsPanel';
import InventoryView, { type InventoryReportPreset } from './InventoryView';
import ReportsPanel from './ReportsPanel';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Boxes, Eye, Settings2, Tags, MapPin, Ruler, Truck, Shield, ClipboardList } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { PageHeader, EmptyState } from '@/app/admin/payroll/_components/ui';

const tabs = [
    { key: 'overview', label: 'View', icon: Eye },
    { key: 'items', label: 'Stock & Assets', icon: Boxes },
    { key: 'purchases', label: 'Purchases', icon: Truck },
    { key: 'reports', label: 'Reports', icon: ClipboardList },
    { key: 'setup', label: 'Setup', icon: Settings2 },
] as const;
const setupTabs = [
    { key: 'categories', label: 'Categories', icon: Tags, description: 'Organise stationery, furniture, equipment and other items.' },
    { key: 'units', label: 'Units', icon: Ruler, description: 'Define how items are counted, such as pieces, boxes and litres.' },
    { key: 'locations', label: 'Locations', icon: MapPin, description: 'Organise stores, classrooms, labs and offices.' },
    { key: 'suppliers', label: 'Suppliers', icon: Truck, description: 'Keep supplier contact and purchase details together.' },
] as const;

export default function InventoryPage() {
    const user = useAuthStore(s => s.user);
    const [tab, setTab] = useState<typeof tabs[number]['key']>('overview');
    const [reportPreset, setReportPreset] = useState<InventoryReportPreset>({ report:'stock',returnStatus:'pending' });
    const [setup, setSetup] = useState<typeof setupTabs[number]['key']>('categories');

    const setupNavigation = <div className="max-w-full overflow-x-auto"><div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50 w-fit">
                        {setupTabs.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setSetup(key)} aria-pressed={setup === key} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${setup === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Icon size={14} />{label}</button>)}
                    </div></div>;

    if (!user) return null;
    if (user.role === 'SUB_ADMIN' && !user.permissions?.includes('INVENTORY')) {
        return <EmptyState icon={Shield} title="Inventory access restricted" text="Contact your admin to request inventory access." />;
    }

    return (
        <div className="h-full min-h-0 flex flex-col px-1">
            <div className="shrink-0 pt-0 pb-1 overflow-x-auto">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {tabs.map(({ key, label, icon: Icon }) => (
                        <button key={key} type="button" onClick={() => setTab(key)} className="relative" aria-pressed={tab === key}>
                            {tab === key && <motion.div layoutId="inventoryTab" className="absolute inset-0 bg-primary rounded-4xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                            <span className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap ${tab === key ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                <Icon size={14} />{label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pb-6 space-y-3">
                {tab === 'overview' && <PageHeader title="View" subtitle="View school stock, assets and inventory alerts." />}
                {tab === 'overview' && <InventoryView onSetup={() => setTab('setup')} onItems={() => setTab('items')} onReports={preset => { setReportPreset(preset); setTab('reports'); }} />}
                {tab === 'items' && <ItemsPanel onSetup={() => setTab('setup')} />}
                {tab === 'purchases' && <PurchasesPanel />}
                {tab === 'reports' && <ReportsPanel initialReport={reportPreset.report} initialReturnStatus={reportPreset.returnStatus} />}
                {tab === 'setup' && <>

                    {setup === 'categories' ? <CategoriesPanel setupNavigation={setupNavigation} /> : setup === 'units' ? <UnitsPanel setupNavigation={setupNavigation} /> : setup === 'locations' ? <LocationsPanel setupNavigation={setupNavigation} /> : <SuppliersPanel setupNavigation={setupNavigation} />}
                </>}
            </div>
        </div>
    );
}
