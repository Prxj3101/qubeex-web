import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Converts an uppercase enum-style string ("MALE", "FEMALE", "OTHER") into
// title case ("Male", "Female", "Other") for display purposes only.
export function toTitleCase(value?: string | null): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// Formats a raw token count for display, scaling to K/M so small real usage
// (e.g. 2,000 tokens) doesn't round away to "0.0M" against a multi-million pool.
// `decimals` (default 1) controls precision at the M scale — bump it to 2 when
// displaying a value that's a large pool minus a comparatively tiny amount
// (e.g. "remaining" after subtracting one teacher's usage), since 1 decimal
// often rounds the subtraction away entirely and the number looks unchanged.
export function formatTokens(n: number, decimals: number = 1): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
}
