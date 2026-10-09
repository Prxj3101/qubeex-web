'use client';

// The feel of real chalk on the classroom board: a soft scratching sound that
// follows how fast the hand moves, and a little chalk dust falling from the tip
// (pale for writing, greyer for the eraser). All generated in the browser - no files.
import { useCallback, useEffect, useRef } from 'react';

type Dust = { x: number; y: number; vx: number; vy: number; life: number; r: number; tint: string };

/** `volume` is 0 (silent) to 1; the dust is drawn either way. */
export function useChalkFeel({ enabled, volume }: { enabled: boolean; volume: number }) {
    const dustCanvas = useRef<HTMLCanvasElement | null>(null);
    const particles = useRef<Dust[]>([]);
    const raf = useRef<number | null>(null);

    const audio = useRef<{ ctx: AudioContext; gain: GainNode; filter: BiquadFilterNode } | null>(null);
    const last = useRef<{ x: number; y: number; t: number } | null>(null);

    const ensureAudio = useCallback(() => {
        if (audio.current) return audio.current;
        try {
            const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const ctx = new Ctx();
            // Looping white noise -> band-pass (the "scratch") -> gain (follows hand speed).
            const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource();
            src.buffer = buf; src.loop = true;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 3200; filter.Q.value = 0.9;
            const gain = ctx.createGain();
            gain.gain.value = 0;
            src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            src.start();
            audio.current = { ctx, gain, filter };
        } catch { audio.current = null; }
        return audio.current;
    }, []);

    // The animation loop calls itself, so it lives in a ref (set once below).
    const stepRef = useRef<() => void>(() => {});
    useEffect(() => {
        stepRef.current = () => {
            const c = dustCanvas.current;
            if (!c) { raf.current = null; return; }
            if (c.width !== c.clientWidth || c.height !== c.clientHeight) { c.width = c.clientWidth; c.height = c.clientHeight; }
            const ctx = c.getContext('2d')!;
            ctx.clearRect(0, 0, c.width, c.height);
            particles.current = particles.current.filter(p => p.life > 0);
            for (const p of particles.current) {
                p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.vx *= 0.985; p.life -= 0.022;
                ctx.globalAlpha = Math.max(0, p.life) * 0.7;
                ctx.fillStyle = p.tint;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            }
            raf.current = particles.current.length ? requestAnimationFrame(() => stepRef.current()) : null;
            if (!particles.current.length) ctx.clearRect(0, 0, c.width, c.height);
        };
    }, []);

    useEffect(() => () => {
        if (raf.current) cancelAnimationFrame(raf.current);
        audio.current?.ctx.close().catch(() => {});
        audio.current = null;
    }, []);

    /** Call on every pointer move while drawing. */
    const move = useCallback((x: number, y: number, tool: 'chalk' | 'eraser') => {
        if (!enabled) return;
        const now = performance.now();
        const prev = last.current;
        last.current = { x, y, t: now };
        const speed = prev ? Math.hypot(x - prev.x, y - prev.y) / Math.max(1, now - prev.t) : 0; // px per ms

        if (volume > 0) {
            const a = ensureAudio();
            if (a) {
                if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
                const vol = Math.min(0.16, speed * 0.07) * (tool === 'eraser' ? 0.7 : 1) * (volume / 0.7);
                a.filter.frequency.setTargetAtTime(tool === 'eraser' ? 1400 : 2400 + Math.min(2200, speed * 900), a.ctx.currentTime, 0.03);
                a.gain.gain.setTargetAtTime(vol, a.ctx.currentTime, 0.02);
            }
        }

        if (speed > 0.15) {
            const n = Math.min(3, 1 + Math.floor(speed * 1.5));
            for (let i = 0; i < n && particles.current.length < 90; i++) {
                particles.current.push({
                    x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4,
                    vx: (Math.random() - 0.5) * 0.7, vy: Math.random() * 0.3,
                    life: 0.7 + Math.random() * 0.5, r: 0.7 + Math.random() * (tool === 'eraser' ? 1.8 : 1.2),
                    tint: tool === 'eraser' ? '#B9C4BE' : '#F4F1E8',
                });
            }
            if (!raf.current) raf.current = requestAnimationFrame(() => stepRef.current());
        }
    }, [enabled, volume, ensureAudio]);

    /** Call when the stroke ends: hush the scratch. */
    const stop = useCallback(() => {
        last.current = null;
        const a = audio.current;
        if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.04);
    }, []);

    const layer = enabled ? (
        <canvas ref={dustCanvas} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 25 }} aria-hidden />
    ) : null;

    return { move, stop, layer };
}
