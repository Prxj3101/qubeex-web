// One place that decides how every purchase status looks, so the same word always has the same colour.
export type StatusTone = 'muted' | 'primary' | 'green' | 'amber' | 'red' | 'blue';

const ORDER: Record<string, StatusTone> = {
    PENDING: 'amber', APPROVED: 'blue', PARTIALLY_RECEIVED: 'blue', COMPLETED: 'green', REJECTED: 'red', CLOSED: 'muted',
};
const REQUEST: Record<string, StatusTone> = {
    PENDING: 'amber', CHANGES_REQUESTED: 'amber', APPROVED: 'green', REJECTED: 'red', PARTIALLY_ISSUED: 'blue', ISSUED: 'green', RETURN_PENDING: 'amber', RETURNED: 'green', CLOSED: 'muted',
};
export const orderTone = (status: string): StatusTone => ORDER[status] ?? 'muted';
export const requestTone = (status: string): StatusTone => REQUEST[status] ?? 'muted';
