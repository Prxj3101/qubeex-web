'use client';

import { Suspense, useState } from 'react';
import { CalendarClock, FileBarChart, Grid3x3, UserRoundCog, Warehouse } from 'lucide-react';
import { StudioClient } from './StudioClient';
import { SetupClient } from './SetupClient';
import { ResourcesClient } from './ResourcesClient';
import { ViewsClient } from './ViewsClient';
import { ChangesClient } from './ChangesClient';

type Tab = 'timetable' | 'setup' | 'resources' | 'reports' | 'changes';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'timetable', label: 'Timetable', icon: Grid3x3 },
    { id: 'setup', label: 'Periods & days', icon: CalendarClock },
    { id: 'resources', label: 'Rooms & teachers', icon: Warehouse },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'changes', label: 'Substitutions & changes', icon: UserRoundCog },
];

/**
 * Everything about one class's timetable in a single place: the grid plus the school-wide settings,
 * as tabs, so nobody has to leave the class page (and lose their place) to change periods or rooms.
 */
export function ClassTimetableEditor({ divisionId, onChanged }: { divisionId: string; onChanged?: () => void }) {
    const [tab, setTab] = useState<Tab>('timetable');
    const [visited, setVisited] = useState<Set<Tab>>(new Set(['timetable']));
    const [settingsTouched, setSettingsTouched] = useState(false);
    const [studioKey, setStudioKey] = useState(0);

    const open = (t: Tab) => {
        // Coming back from a settings tab: remount the grid so new periods/rooms/teachers show up.
        if (t === 'timetable' && settingsTouched) { setStudioKey(k => k + 1); setSettingsTouched(false); }
        if (t !== 'timetable') setSettingsTouched(true);
        setVisited(v => (v.has(t) ? v : new Set(v).add(t)));
        setTab(t);
    };

    const pane = (id: Tab, node: React.ReactNode) => (visited.has(id) ? <div className={tab === id ? 'block' : 'hidden'}>{node}</div> : null);

    return (
        <div className="space-y-4">
            <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-border/60 px-1">
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id} type="button" onClick={() => open(t.id)}
                            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${tab === t.id ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                            <Icon className="w-4 h-4" /> {t.label}
                        </button>
                    );
                })}
            </div>

            {pane('timetable', <Suspense key={studioKey} fallback={null}><StudioClient fixedDivisionId={divisionId} onChanged={onChanged} onNavigate={t => open(t)} /></Suspense>)}
            {pane('setup', <SetupClient />)}
            {pane('resources', <ResourcesClient />)}
            {pane('reports', <ViewsClient initialKind="class" initialTargetId={divisionId} />)}
            {pane('changes', <ChangesClient />)}
        </div>
    );
}
