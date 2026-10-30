'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import SchoolDrawing from './SchoolDrawing';

// 3D school island. Three.js is loaded only in the browser, after the page
// paints. If WebGL is missing, the pencil drawing is shown instead.
function hasWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
        return false;
    }
}

export default function School3D({ className }: { className?: string }) {
    const box = useRef<HTMLDivElement>(null);
    const still = useReducedMotion();
    const [mode, setMode] = useState<'loading' | '3d' | '2d'>('loading');

    useEffect(() => {
        if (!hasWebGL()) { setMode('2d'); return; }
        let dispose: (() => void) | undefined;
        let cancelled = false;
        // Building the 3D scene is heavy work for the browser. Wait until the
        // nav bar and the hero text have finished sliding in (and the browser
        // is idle), so those first animations stay smooth on refresh.
        const start = () => {
            import('./school3d-scene')
                .then(({ createSchoolScene }) => {
                    if (cancelled || !box.current) return;
                    dispose = createSchoolScene(box.current, { still: !!still }).dispose;
                    setMode('3d');
                })
                .catch(() => setMode('2d'));
        };
        let idle = 0;
        const timer = window.setTimeout(() => {
            if ('requestIdleCallback' in window) idle = window.requestIdleCallback(start, { timeout: 700 });
            else start();
        }, 1900); // after the last intro animation (crayon underline) is done
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            if (idle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idle);
            dispose?.();
        };
    }, [still]);

    if (mode === '2d') return <SchoolDrawing className={className} />;

    return (
        <div className={className}>
            <div
                ref={box}
                className="relative aspect-[6/5] w-full transition-opacity duration-700"
                style={{ opacity: mode === '3d' ? 1 : 0 }}
                role="img"
                aria-label="A small 3D school with a waving flag, a school bus and kids playing"
            />
        </div>
    );
}
