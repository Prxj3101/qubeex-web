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

// Fixed light-mode value per preset, hardcoded from globals.css's own
// [data-theme="X"] blocks (not .dark[data-theme="X"]) — for surfaces that are
// deliberately styled as a permanent light card regardless of the app's own
// dark/light toggle (e.g. the admin campus student-search ID card: white
// background, dark text, always). Those cards used to just hardcode purple;
// now they follow the institution's chosen preset, but only ever the light
// variant of it, since reading the live --primary/--hero-accent var would
// pick up the .dark override the moment the admin's OS/app is in dark mode,
// clashing with the card's permanently-light chrome.
const LIGHT_THEME_COLORS: Record<string, { primary: string; heroAccent: string }> = {
    purple: { primary: '#7C3AED', heroAccent: '#7C3AED' },
    blue: { primary: '#3970E0', heroAccent: '#2F6AE6' },
    teal: { primary: '#009999', heroAccent: '#008080' },
    amber: { primary: '#ED9A1F', heroAccent: '#ED9A1F' },
    rose: { primary: '#DC3D2E', heroAccent: '#DC3D2E' },
    indigo: { primary: '#5956EB', heroAccent: '#5956EB' },
    slate: { primary: '#64748B', heroAccent: '#64748B' },
};

/**
 * Same idea as useThemeAccent, but always resolves to the LIGHT-mode hex for
 * whichever preset is active — ignores the `.dark` class entirely, only
 * reacts to `data-theme` changing. Use for chrome that's intentionally
 * styled as a fixed light card in both app themes.
 */
export function useLightThemeAccent(key: 'primary' | 'heroAccent' = 'primary') {
    const [color, setColor] = useState(LIGHT_THEME_COLORS.purple[key]);

    useLayoutEffect(() => {
        const read = () => {
            const id = document.documentElement.getAttribute('data-theme') || 'purple';
            setColor((LIGHT_THEME_COLORS[id] ?? LIGHT_THEME_COLORS.purple)[key]);
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, [key]);

    return color;
}
