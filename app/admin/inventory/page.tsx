'use client';

import { InventoryPillTarget } from './InventoryNavPills';
import PurchasesPanel from './PurchasesPanel';
import CategoriesPanel from './CategoriesPanel';
import UnitsPanel from './UnitsPanel';
import LocationsPanel from './LocationsPanel';
import SuppliersPanel from './SuppliersPanel';
import StockAndAssetsPanel from './StockAndAssetsPanel';
import InventoryView, { type InventoryReportPreset } from './InventoryView';
import ReportsPanel from './ReportsPanel';
import { Suspense, useState } from 'react';
import { useInventoryNavigation, updateInventoryNavigation } from './useInventoryNavigation';
import { motion } from 'framer-motion';
import { Boxes, Eye, Settings2, Tags, MapPin, Ruler, Truck, Shield, ClipboardList } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { PageHeader, EmptyState } from '@/app/admin/payroll/_components/ui';

const tabs = [
    { key: 'overview', label: 'View', icon: Eye },
    { key: 'items', label: 'Ledger & Stock', icon: Boxes },
    { key: 'purchases', label: 'Purchases', icon: Truck },
    { key: 'reports', label: 'Reports', icon: ClipboardList },
] as const;
type InventoryTab = typeof tabs[number]['key'] | 'setup';
const setupTabs = [
    { key: 'categories', label: 'Categories', icon: Tags, description: 'Organise stationery, furniture, equipment and other items.' },
    { key: 'units', label: 'Units', icon: Ruler, description: 'Define how items are counted, such as pieces, boxes and litres.' },
    { key: 'locations', label: 'Locations', icon: MapPin, description: 'Organise stores, classrooms, labs and offices.' },
    { key: 'suppliers', label: 'Suppliers', icon: Truck, description: 'Keep supplier contact and purchase details together.' },
] as const;

function InventoryPageContent() {
    const [pillTarget, setPillTarget] = useState<HTMLDivElement | null>(null);
    const user = useAuthStore(s => s.user);
    const [tab, setTab] = useInventoryNavigation<InventoryTab>('tab', ['overview', 'items', 'purchases', 'reports', 'setup'], 'overview');
    const [reportPreset, setReportPreset] = useState<InventoryReportPreset>({ report:'stock',returnStatus:'pending' });
    const [setup, setSetup] = useInventoryNavigation<typeof setupTabs[number]['key']>('setup', ['categories', 'units', 'locations', 'suppliers'], 'categories');

    const setupNavigation = <div className="max-w-full overflow-x-auto"><div className="flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50 w-fit">
                        {setupTabs.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setSetup(key)} aria-pressed={setup === key} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${setup === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Icon size={14} />{label}</button>)}
                    </div></div>;

    if (!user) return null;
    if (user.role === 'SUB_ADMIN' && !user.permissions?.includes('INVENTORY')) {
        return <EmptyState icon={Shield} title="Inventory access restricted" text="Contact your admin to request inventory access." />;
    }

    return (
        <InventoryPillTarget.Provider value={pillTarget}><div className="h-full min-h-0 flex flex-col px-1">
            <div className="shrink-0 pt-0 pb-1 max-w-full overflow-x-auto sm:overflow-visible">
                <div className="flex items-center gap-2 w-full">
                <div className="flex items-center gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {tabs.map(({ key, label, icon: Icon }) => (
                        <button key={key} type="button" onClick={() => setTab(key)} className="relative" aria-pressed={tab === key}>
                            {tab === key && <motion.div layoutId="inventoryTab" className="absolute inset-0 bg-primary rounded-4xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                            <span className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap ${tab === key ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                <Icon size={14} />{label}
                            </span>
                        </button>
                    ))}
                </div>
                    <div className="relative group shrink-0">
                        <button type="button" onClick={() => setTab('setup')} aria-pressed={tab === 'setup'} aria-label="Setup" className={`relative flex items-center justify-center w-[41px] h-[41px] rounded-full border border-border/50 transition-colors ${tab === 'setup' ? 'text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                            {tab === 'setup' && <motion.div layoutId="inventoryTab" className="absolute inset-0 bg-primary rounded-full" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                            <Settings2 size={16} className="relative z-10" />
                        </button>
                        <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 z-50 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Setup</span>
                    </div>
                <div ref={setPillTarget} className="ml-auto shrink-0 flex items-center pl-3">{tab === 'setup' && setupNavigation}</div>
                </div>
            </div>
            <div className={tab !== 'overview' ? `flex-1 min-h-0 flex flex-col gap-3 pb-3 overflow-visible` : 'flex-1 min-h-0 overflow-y-auto pb-6 space-y-3'}>
                {tab === 'overview' && <PageHeader title="View" subtitle="View school stock, assets and inventory alerts." />}
                {tab === 'overview' && <InventoryView onSetup={() => setTab('setup')} onItems={() => setTab('items')} onPurchases={() => setTab('purchases')} onReports={preset => { setReportPreset(preset); updateInventoryNavigation({ tab: 'reports', report: preset.report }); }} />}
                {tab === 'items' && <StockAndAssetsPanel onSetup={() => setTab('setup')} />}
                {tab === 'purchases' && <PurchasesPanel />}
                {tab === 'reports' && <ReportsPanel initialReport={reportPreset.report} initialReturnStatus={reportPreset.returnStatus} />}
                {tab === 'setup' && <>

                    {setup === 'categories' ? <CategoriesPanel setupNavigation={null} /> : setup === 'units' ? <UnitsPanel setupNavigation={null} /> : setup === 'locations' ? <LocationsPanel setupNavigation={null} /> : <SuppliersPanel setupNavigation={null} />}
                </>}
            </div>
        </div></InventoryPillTarget.Provider>
    );
}

export default function InventoryPage() {
 return <Suspense fallback={null}><InventoryPageContent /></Suspense>;
}
