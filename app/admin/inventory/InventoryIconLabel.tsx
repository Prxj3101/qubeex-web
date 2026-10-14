'use client';
import { inventoryDateTime } from './inventory-date-time';
import { Pill } from '@/app/admin/payroll/_components/ui';
import { SetupArtwork } from './SetupArtwork';
import { SupplierArtwork } from './SupplierArtwork';

export function InventoryIconLabel({ kind, name, id, children }: { kind: 'categories' | 'locations' | 'units' | 'suppliers'; name: string; id?: string; children?: React.ReactNode }) {
    return <span className="inline-flex max-w-full items-center gap-2 align-middle">
        {kind === 'suppliers' ? id && <SupplierArtwork id={id} size={24} /> : <SetupArtwork kind={kind} name={name} size={24} />}
        <span className="min-w-0 break-words">{children ?? name}</span>
    </span>;
}

export function ReportIconCell({ column, value }: { column: string; value: string | number }) {
    if (typeof value !== 'string') return <>{value.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</>;
    if (column === 'Recorded at') return <>{inventoryDateTime(value)}</>;
    if (column === 'Status') return <Pill tone={value === 'In stock' ? 'green' : value === 'Low stock' || value === 'Return pending' ? 'amber' : value === 'No stock' || value === 'Overdue' ? 'red' : 'muted'}>{value || '-'}</Pill>;
    if (column === 'Category') return <InventoryIconLabel kind="categories" name={value} />;
    if (column === 'Location') return <InventoryIconLabel kind="locations" name={value} />;
    if (column === 'Locations' && value !== 'No stock recorded') return <span className="flex flex-col gap-1">{value.split('; ').map((entry, index) => <InventoryIconLabel key={index} kind="locations" name={entry.slice(0, entry.lastIndexOf(':')).trim()}>{entry}</InventoryIconLabel>)}</span>;
    return <>{value || '-'}</>;
}
