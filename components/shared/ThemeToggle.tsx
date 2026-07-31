'use client';

import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const mounted = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false
    );

    if (!mounted) return <button className="h-9 w-9" />;

    // `theme` stays 'system' until the user explicitly picks a mode, so on a
    // fresh login it doesn't reflect what's actually on screen. If the
    // system preference happens to already be dark, clicking once just sets
    // theme to 'dark' explicitly — same as what's already rendered, so
    // nothing visibly changes and it looks like the button needs a second
    // click. `resolvedTheme` always reflects the actual rendered mode
    // (system preference already resolved), so toggling off of it flips the
    // UI on the very first click.
    const isDark = resolvedTheme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition"
        >
            <motion.div
                key={isDark ? 'moon' : 'sun'}
                initial={{ rotate: -120, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 120, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            >
                {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </motion.div>
        </button>
    );
}
