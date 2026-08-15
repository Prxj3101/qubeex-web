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
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
}
