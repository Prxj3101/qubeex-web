'use client';
import Image from 'next/image';

// Supplier UUIDs already contain randomness. A stable hash keeps the same icon
// across refreshes, devices, renaming and reordering without storing extra data.
export function supplierArtworkIndex(id: string) {
 let hash = 2166136261;
 for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
 return (hash >>> 0) % 5 + 1;
}

export function SupplierArtwork({ id, size = 48 }: { id: string; size?: 24 | 48 }) {
 return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${size === 24 ? "h-6 w-6" : "h-12 w-12"}`}>
  <Image unoptimized src={'/images/inventory/setup/supplier-' + supplierArtworkIndex(id) + '-3d-v1.webp'} alt="" width={size} height={size} draggable={false} className="h-full w-full object-contain select-none" />
 </span>;
}
