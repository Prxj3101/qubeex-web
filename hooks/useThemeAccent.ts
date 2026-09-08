'use client';

import { useLayoutEffect, useState } from 'react';

/**
 * Reads a theme CSS variable (default `--primary`) straight off <html>, so
 * components that need an actual JS color string (SVG fill, inline
 * background, etc — places `hsl(var(--x))` in a className can't reach) stay
 * in sync with whatever accent the admin picked in Settings, instead of
 * hardcoding a color. Re-reads whenever `class` (dark mode) or `data-theme`
 * (accent preset) changes on <html>, since both flip the resolved value via
 * the cascade already set up in globals.css.
 *
 * useLayoutEffect (not useEffect) on purpose: the initial `#7C3AED` state
 * below is just a fallback for the instant before this runs, and useEffect
 * fires after the browser has already painted — so on a hard refresh with a
 * non-purple theme picked, that fallback purple would flash on screen for a
 * frame before snapping to the real color. useLayoutEffect resolves it
 * synchronously before paint, so that frame never actually renders.
 */
export function useThemeAccent(varName: string = '--primary') {
    const [color, setColor] = useState('#7C3AED');

    useLayoutEffect(() => {
        const read = () => {
            const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            if (value) setColor(value);
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        return () => observer.disconnect();
    }, [varName]);

    return color;
}
