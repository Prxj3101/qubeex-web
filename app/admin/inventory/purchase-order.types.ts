export interface PurchaseLine { name: string; quantity: number; unit: string }
export interface OrderLine extends PurchaseLine { itemId: string; requestedName: string; code: string; unitPrice: string; taxPercent: string; subtotal: string; tax: string; total: string; cancelledQuantity: number; accepted: number; delivered: number; rejected: number; pending: number }
export interface PurchaseOrder {
    id: string; purchaseRequestId: string; number: string; supplierId: string; supplierSnapshot: { name: string; address: string; phone: string; email: string };
    locationId: string; locationName: string; expectedOn: string; instructions: string; lines: OrderLine[]; total: string; status: string; revision: number; createdById: string;
    events: { action: string; reason: string; actorRole: string; at: string }[];
    receipts: { id: string; purchaseOrderLine: number; quantity: string; deliveredQuantity: string; rejectedQuantity: string; damageReason: string; recordedOn: string; billNumber: string; notes: string; attachments: { name: string; url: string }[] }[];
}
export const orderLabels: Record<string, string> = { PENDING: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected', PARTIALLY_RECEIVED: 'Partially received', COMPLETED: 'Completed', CLOSED: 'Closed', SUBMITTED: 'Submitted', RESUBMITTED: 'Resubmitted', RECEIVED: 'Delivery recorded' };
export const orderMoney = (value: number | string) => `INR ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const orderDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });
