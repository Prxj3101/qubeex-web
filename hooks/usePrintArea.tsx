'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Print just one piece of the UI (the timetable), not the whole page.
 *
 * `start()` mounts a print-only copy (via <PrintPortal>) directly under <body>; the `tt-printing` body
 * class makes the print stylesheet in globals.css hide everything else. Only the component that called
 * start() renders a print copy, so other mounted timetable panes never get printed by accident.
 */
export function usePrintArea() {
    const [printing, setPrinting] = useState(false);
    const start = useCallback(() => setPrinting(true), []);

    useEffect(() => {
        if (!printing) return;
        const html = document.documentElement;
        const wasDark = html.classList.contains('dark');
        const style = document.createElement('style');
        style.textContent = '@page { size: A4 landscape; margin: 10mm; }';
        document.head.appendChild(style);
        document.body.classList.add('tt-printing');
        if (wasDark) html.classList.remove('dark'); // paper is white; don't print the dark theme

        const cleanup = () => {
            style.remove();
            document.body.classList.remove('tt-printing');
            if (wasDark) html.classList.add('dark');
        };
        const done = () => { cleanup(); setPrinting(false); };
        window.addEventListener('afterprint', done, { once: true });
        const t = setTimeout(() => window.print(), 80); // let the portal render first

        return () => {
            clearTimeout(t);
            window.removeEventListener('afterprint', done);
            cleanup();
        };
    }, [printing]);

    return { printing, start };
}

/** Print-only content, mounted under <body>. Invisible on screen. */
export function PrintPortal({ children }: { children: React.ReactNode }) {
    if (typeof document === 'undefined') return null;
    return createPortal(<div data-tt-print-root>{children}</div>, document.body);
}
