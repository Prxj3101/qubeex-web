'use client';

// "Need the school bus?" Yes / No, plus the pickup area when yes.
// Stored in one text field (details.transport): "" not answered, "No", "Yes",
// or the pickup area (which means yes). Older free-text answers read as yes.
// Used on the admin application form and the parents' online form; students
// who said yes land on Transport → Waiting list once admitted.

export function parseBusNeed(v: string): { need: boolean | null; area: string } {
    const t = v.trim();
    if (!t) return { need: null, area: '' };
    if (/^no$/i.test(t)) return { need: false, area: '' };
    if (/^yes$/i.test(t)) return { need: true, area: '' };
    return { need: true, area: t };
}

export function BusNeedField({ value, onChange, inputClassName, accent = '#DA7756' }: {
    value: string;
    onChange: (v: string) => void;
    inputClassName: string;
    accent?: string;
}) {
    const { need, area } = parseBusNeed(value);
    const pill = (active: boolean) => active
        ? { borderColor: accent, background: `${accent}1A`, color: accent }
        : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' };
    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                {([['yes', '🚌 Yes'], ['no', 'No']] as const).map(([k, label]) => {
                    const active = k === 'yes' ? need === true : need === false;
                    return (
                        <button key={k} type="button" aria-pressed={active}
                            onClick={() => onChange(k === 'yes' ? (area || 'Yes') : 'No')}
                            className="h-9 flex-1 rounded-xl border-2 text-sm font-semibold transition-all" style={pill(active)}>
                            {label}
                        </button>
                    );
                })}
            </div>
            {need === true && (
                <input maxLength={160} className={inputClassName} placeholder="Pickup area, e.g. Nallasopara West station"
                    value={area} onChange={e => onChange(e.target.value.trim() ? e.target.value : 'Yes')} />
            )}
        </div>
    );
}
