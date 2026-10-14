'use client';
import { inventoryDateTime } from './inventory-date-time';
import { Check, X, Clock } from 'lucide-react';

export type TimelineStep = { label: string; state: 'done' | 'current' | 'todo' | 'bad'; note?: string };

// A simple horizontal progress line: done steps are green, the current step glows, rejected steps are red.
export function PurchaseTimeline({ steps }: { steps: TimelineStep[] }) {
    return <ol className="flex w-full items-start" aria-label="Progress">{steps.map((step, i) => {
        const last = i === steps.length - 1;
        const dot = step.state === 'done' ? 'bg-emerald-500 text-white' : step.state === 'bad' ? 'bg-rose-500 text-white' : step.state === 'current' ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-muted text-muted-foreground';
        return <li key={step.label} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {!last && <span className={`absolute left-1/2 top-3.5 h-0.5 w-full ${step.state === 'done' ? 'bg-emerald-500' : 'bg-border'}`} />}
            <span className={`relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${dot}`}>
                {step.state === 'done' ? <Check size={14} /> : step.state === 'bad' ? <X size={14} /> : step.state === 'current' ? <Clock size={13} /> : i + 1}
            </span>
            <span className={`mt-1.5 px-1 text-[11px] font-semibold leading-tight ${step.state === 'todo' ? 'text-muted-foreground' : ''}`}>{step.label}</span>
            {step.note && <span className="mt-0.5 px-1 text-[10px] leading-tight text-muted-foreground">{step.note}</span>}
        </li>;
    })}</ol>;
}

const shortDate = (iso?: string) => iso ? inventoryDateTime(iso) : undefined;
type Event = { action: string; at: string };
const lastAt = (events: Event[], ...actions: string[]) => [...events].reverse().find(e => actions.includes(e.action))?.at;

export function orderSteps(status: string, events: Event[]): TimelineStep[] {
    const placed = shortDate(events[0]?.at);
    if (status === 'REJECTED') return [
        { label: 'Placed', state: 'done', note: placed }, { label: 'Rejected', state: 'bad', note: shortDate(lastAt(events, 'REJECTED')) },
        { label: 'Delivery', state: 'todo' }, { label: 'Completed', state: 'todo' },
    ];
    const approvedAt = shortDate(lastAt(events, 'APPROVED'));
    const approved = status !== 'PENDING';
    const delivered = status === 'COMPLETED' || status === 'CLOSED';
    return [
        { label: 'Placed', state: 'done', note: placed },
        { label: 'Approved', state: approved ? 'done' : 'current', note: approved ? approvedAt : 'Waiting' },
        { label: status === 'PARTIALLY_RECEIVED' ? 'Partly delivered' : 'Delivery', state: delivered ? 'done' : approved ? 'current' : 'todo' },
        { label: status === 'CLOSED' ? 'Closed' : 'Completed', state: status === 'COMPLETED' ? 'done' : status === 'CLOSED' ? 'bad' : 'todo', note: shortDate(lastAt(events, 'COMPLETED', 'CLOSED')) },
    ];
}

export function requestSteps(status: string, events: Event[], hasOrder: boolean): TimelineStep[] {
    const submitted = shortDate(events[0]?.at);
    if (status === 'REJECTED') return [{ label: 'Submitted', state: 'done', note: submitted }, { label: 'Rejected', state: 'bad', note: shortDate(lastAt(events, 'REJECTED')) }, { label: 'Order placed', state: 'todo' }];
    if (status === 'CHANGES_REQUESTED') return [{ label: 'Submitted', state: 'done', note: submitted }, { label: 'Changes needed', state: 'current', note: 'Edit and resubmit' }, { label: 'Order placed', state: 'todo' }];
    const approved = status === 'APPROVED';
    return [
        { label: 'Submitted', state: 'done', note: submitted },
        { label: 'Approved', state: approved ? 'done' : 'current', note: approved ? shortDate(lastAt(events, 'APPROVED')) : 'Waiting' },
        { label: 'Order placed', state: hasOrder ? 'done' : approved ? 'current' : 'todo' },
    ];
}
