'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { CONFLICT_LABEL, type Conflict } from '@/lib/timetable';

export function ConflictList({ conflicts, onSelect, empty }: { conflicts: Conflict[]; onSelect?: (c: Conflict) => void; empty?: string }) {
    if (!conflicts.length) return <p className="text-sm text-muted-foreground">{empty ?? 'No conflicts.'}</p>;
    return (
        <ul className="space-y-2">
            {conflicts.map((c, i) => {
                const err = c.severity === 'ERROR';
                const Icon = err ? AlertTriangle : Info;
                return (
                    <li key={i}>
                        <button
                            type="button"
                            onClick={() => onSelect?.(c)}
                            className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors ${err ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10' : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'} ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <div className={`flex items-center gap-1.5 font-semibold ${err ? 'text-red-600' : 'text-amber-600'}`}>
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                {CONFLICT_LABEL[c.type] ?? c.type}
                            </div>
                            <div className="text-foreground/80 mt-0.5">{c.message}</div>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
