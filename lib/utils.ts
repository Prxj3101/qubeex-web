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
