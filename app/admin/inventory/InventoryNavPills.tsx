'use client';
import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
export const InventoryPillTarget = createContext<HTMLDivElement | null>(null);
export function InventoryNavPills({ children }: { children: React.ReactNode }) {
 const target = useContext(InventoryPillTarget);
 return target ? createPortal(children, target) : null;
}
