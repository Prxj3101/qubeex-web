// Bus fee for one fee month, read from a student's fee-card fields. Same rule
// as the backend (src/services/studentBus.service.ts) and the mobile app:
//   `${id}-monthFees` { monthId: amount }  months locked at the amount they had
//                                          (already due/paid when the bus was
//                                          turned off or the fee changed)
//   otherwise, when `${id}-enabled` is "true" and the month is in
//   `${id}-months`, the current `${id}-fee`.
// Returns null when there's no bus fee that month.

type Fields = Record<string, string> | null | undefined;

function lockedAmounts(raw: string | undefined): Record<string, number> {
    if (!raw) return {};
    try {
        const v = JSON.parse(raw);
        if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
        return Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))) as Record<string, number>;
    } catch { return {}; }
}

export function busMonthIds(fields: Fields, fieldId: string): string[] {
    const raw = fields?.[`${fieldId}-months`];
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
}

export function busMonthAmount(fields: Fields, fieldId: string, monthId: string): number | null {
    const locked = lockedAmounts(fields?.[`${fieldId}-monthFees`]);
    if (monthId in locked) return locked[monthId];
    if (fields?.[`${fieldId}-enabled`] !== 'true') return null;
    if (!busMonthIds(fields, fieldId).includes(monthId)) return null;
    return Number(fields?.[`${fieldId}-fee`]) || 0;
}
