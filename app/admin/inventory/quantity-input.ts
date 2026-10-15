// Consumables (paper, ink, litres, kilograms) can be counted with up to 3 decimal places.
// Equipment and fixed assets stay whole numbers.
export const qtyPattern = (decimals: boolean) => decimals ? /^-?\d*\.?\d{0,3}$/ : /^-?\d*$/;
export const qtyStep = (decimals: boolean) => decimals ? '0.001' : '1';
export const qtyMin = (decimals: boolean) => decimals ? '0.001' : '1';
export const isQty = (value: string, decimals: boolean) => decimals ? /^\d+(\.\d{1,3})?$/.test(value) : /^\d+$/.test(value);
