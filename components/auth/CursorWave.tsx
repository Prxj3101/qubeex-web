'use client';

import { useEffect, useRef } from 'react';

export function CursorWave() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef<{ x: number; y: number } | null>(null);
    const rafRef = useRef<number>(0);
    const timeRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const onMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        const onLeave = () => {
            mouseRef.current = null;
        };
        window.addEventListener('mousemove', onMove);
        document.addEventListener('mouseleave', onLeave);

        const COLS = 48;
        const ROWS = 30;
        const LIFT_RADIUS = 200;
        const MAX_LIFT = 95;
        const THRESHOLD = 2;
        const BG = '#0F0A1E';

        const draw = () => {
            timeRef.current += 0.016;
            const W = canvas.width;
            const H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            if (!mouseRef.current) {
                // Sirf flat grid draw karo
                ctx.lineWidth = 0.5;
                ctx.strokeStyle = 'rgba(255,255,255,0.050)';
                const W = canvas.width;
                const H = canvas.height;

                for (let r = 0; r <= ROWS; r++) {
                    ctx.beginPath();
                    ctx.moveTo(0, (r / ROWS) * H);
                    ctx.lineTo(W, (r / ROWS) * H);
                    ctx.stroke();
                }
                for (let c = 0; c <= COLS; c++) {
                    ctx.beginPath();
                    ctx.moveTo((c / COLS) * W, 0);
                    ctx.lineTo((c / COLS) * W, H);
                    ctx.stroke();
                }

                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;

            // Build grid
            const pts: { sx: number; sy: number; bx: number; by: number; z: number }[][] = [];

            for (let r = 0; r <= ROWS; r++) {
                pts[r] = [];
                for (let c = 0; c <= COLS; c++) {
                    const bx = (c / COLS) * W;
                    const by = (r / ROWS) * H;

                    const dx = bx - mx;
                    const dy = by - my;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    const t = Math.max(0, 1 - dist / LIFT_RADIUS);
                    const smooth = t * t * t * (t * (t * 6 - 15) + 10);
                    const ripple = Math.sin(dist * 0.015 - timeRef.current * 2) * 0.06 * smooth;
                    const z = (smooth + ripple) * MAX_LIFT;

                    const sx = bx;
                    const sy = by - z * 0.65;

                    pts[r][c] = { sx, sy, bx, by, z };
                }
            }

            // ── Pass 1: Draw flat base grid everywhere ──
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.050)';

            // Horizontal
            for (let r = 0; r <= ROWS; r++) {
                ctx.beginPath();
                let drawing = false;
                for (let c = 0; c <= COLS; c++) {
                    const pt = pts[r][c];
                    if (pt.z > THRESHOLD) {
                        if (drawing) { ctx.stroke(); ctx.beginPath(); drawing = false; }
                        continue;
                    }
                    if (!drawing) { ctx.moveTo(pt.bx, pt.by); drawing = true; }
                    else ctx.lineTo(pt.bx, pt.by);
                }
                if (drawing) ctx.stroke();
            }

            // Vertical
            for (let c = 0; c <= COLS; c++) {
                ctx.beginPath();
                let drawing = false;
                for (let r = 0; r <= ROWS; r++) {
                    const pt = pts[r][c];
                    if (pt.z > THRESHOLD) {
                        if (drawing) { ctx.stroke(); ctx.beginPath(); drawing = false; }
                        continue;
                    }
                    if (!drawing) { ctx.moveTo(pt.bx, pt.by); drawing = true; }
                    else ctx.lineTo(pt.bx, pt.by);
                }
                if (drawing) ctx.stroke();
            }



            // ── Pass 3: Draw lifted grid lines (on top of BG fill) ──
            // Horizontal lifted lines
            for (let r = 0; r <= ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const a = pts[r][c];
                    const b = pts[r][c + 1];
                    const avgZ = (a.z + b.z) / 2;
                    if (avgZ < THRESHOLD) continue;

                    const zT = Math.min(1, avgZ / MAX_LIFT);
                    const alpha = 0.12 + zT * 0.55;
                    const bright = Math.round(55 + zT * 145);

                    ctx.beginPath();
                    ctx.moveTo(a.sx, a.sy);
                    ctx.lineTo(b.sx, b.sy);
                    ctx.strokeStyle = `rgba(${bright},${Math.round(bright * 0.72)},${bright},${alpha})`;
                    ctx.lineWidth = 0.5 + zT * 1.0;
                    ctx.stroke();
                }
            }

            // Vertical lifted lines
            for (let c = 0; c <= COLS; c++) {
                for (let r = 0; r < ROWS; r++) {
                    const a = pts[r][c];
                    const b = pts[r + 1][c];
                    const avgZ = (a.z + b.z) / 2;
                    if (avgZ < THRESHOLD) continue;

                    const zT = Math.min(1, avgZ / MAX_LIFT);
                    const alpha = 0.12 + zT * 0.55;
                    const bright = Math.round(55 + zT * 145);

                    ctx.beginPath();
                    ctx.moveTo(a.sx, a.sy);
                    ctx.lineTo(b.sx, b.sy);
                    ctx.strokeStyle = `rgba(${bright},${Math.round(bright * 0.72)},${bright},${alpha})`;
                    ctx.lineWidth = 0.5 + zT * 1.0;
                    ctx.stroke();
                }
            }

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resize);
            document.removeEventListener('mouseleave', onLeave);
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 5 }}
        />
    );
}