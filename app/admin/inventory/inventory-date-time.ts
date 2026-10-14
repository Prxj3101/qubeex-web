// Transaction timestamps use the school's Indian timezone. Business dates
// (due dates, bill dates, filters) remain date-only because no time is stored.
export function inventoryDateTime(value: string | undefined | null) {
 if (!value) return '-';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return '-';
 return parsed.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}
