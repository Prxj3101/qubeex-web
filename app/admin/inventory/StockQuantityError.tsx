interface Props {
    value: string;
    min?: number;
    max?: number;
    limit?: 'available' | 'pending';
    unchangedValue?: string;
    decimals?: boolean;
}

export function StockQuantityError({ value, min = 1, max = 1000000000, limit, unchangedValue, decimals = false }: Props) {
    if (value === '') return null;
    const quantity = Number(value);
    const lowest = decimals && min === 1 ? 0.001 : min;
    const format = (number: number) => number.toLocaleString('en-IN');
    let error = '';
    if (!Number.isFinite(quantity)) error = decimals ? 'Enter a number.' : 'Enter a whole number.';
    else if (decimals ? !/^-?\d*\.?\d{0,3}$/.test(value) : !Number.isInteger(quantity)) error = decimals ? 'Use up to 3 decimal places.' : 'Enter a whole number.';
    else if (quantity < lowest) error = `Enter at least ${format(lowest)}.`;
    else if (quantity > max) error = limit ? `Only ${format(max)} ${limit}. Enter ${format(max)} or less.` : `Enter ${format(max)} or less.`;
    else if (unchangedValue !== undefined && quantity === Number(unchangedValue)) error = 'Enter a different quantity to save a correction.';
    return error ? <p role="alert" className="mt-1 text-xs text-red-500">{error}</p> : null;
}
