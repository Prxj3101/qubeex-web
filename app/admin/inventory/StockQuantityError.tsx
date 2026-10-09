interface Props {
    value: string;
    min?: number;
    max?: number;
    limit?: 'available' | 'pending';
    unchangedValue?: string;
}

export function StockQuantityError({ value, min = 1, max = 1000000000, limit, unchangedValue }: Props) {
    if (value === '') return null;
    const quantity = Number(value);
    const format = (number: number) => number.toLocaleString('en-IN');
    let error = '';
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) error = 'Enter a whole number.';
    else if (quantity < min) error = `Enter at least ${format(min)}.`;
    else if (quantity > max) error = limit ? `Only ${format(max)} ${limit}. Enter ${format(max)} or less.` : `Enter ${format(max)} or less.`;
    else if (unchangedValue !== undefined && quantity === Number(unchangedValue)) error = 'Enter a different quantity to save a correction.';
    return error ? <p role="alert" className="mt-1 text-xs text-red-500">{error}</p> : null;
}
