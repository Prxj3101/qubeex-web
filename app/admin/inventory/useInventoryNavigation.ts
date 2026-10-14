'use client';
import { useSearchParams } from 'next/navigation';

export function updateInventoryNavigation(values: Record<string, string>) {
 const url = new URL(window.location.href);
 for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
 window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function useInventoryNavigation<T extends string>(key: string, choices: readonly T[], fallback: T): [T, (value: T) => void] {
 const params = useSearchParams();
 const raw = params.get(key);
 const value = choices.find(choice => choice === raw) ?? fallback;
 return [value, next => updateInventoryNavigation({ [key]: next })];
}
