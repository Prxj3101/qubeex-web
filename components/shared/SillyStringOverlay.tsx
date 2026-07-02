'use client';

import { useRef, useEffect } from 'react';

interface SillyStringOverlayProps {
    name: string;
    fontSize?: number;
    active?: boolean;
}

export function SillyStringOverlay({ name, fontSize = 30, active = true }: SillyStringOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Scale TOP_EXT so canvas doesn't extend too far above small text (which sits near hero top)
    const topExt = Math.round(70 * Math.min(1, fontSize / 30));

    useEffect(() => {
        if (!active) return;
        const C = canvasRef.current;
        if (!C) return;
        const X = C.getContext('2d')!;

        let W = 0, H = 0;
        let collData: Uint8ClampedArray | null = null;
        let LOX = 0, LOY = 0, LW = 0, LH = 0;
        let ready = false;
        let rafId = 0;

        // Canvas extends: LEFT_EXT px left, TOP_EXT px above, RIGHT_EXT px right, BOT_EXT px below
        // so text in canvas coords starts at (LEFT_EXT, TOP_EXT)
        const LEFT_EXT = 40;
        const TOP_EXT = topExt;
        const RIGHT_EXT = 40;
        const BOT_EXT = 20;
        // Scale emission density + strand thickness by font size (base = 30px)
        const scale = Math.min(1, fontSize / 30);

        async function buildLogo() {
            // Wait for fonts so measureText is accurate
            await document.fonts.ready;

            const font = `600 ${fontSize}px Poppins, sans-serif`;
            const offscreen = document.createElement('canvas');
            offscreen.width = W; offscreen.height = H;
            const ocx = offscreen.getContext('2d')!;
            ocx.font = font;

            const metrics = ocx.measureText(name);
            // actualBoundingBoxRight = exact pixel distance from start to last character's edge
            LW = metrics.actualBoundingBoxRight ?? metrics.width;
            LH = fontSize * 1.2;
            LOX = LEFT_EXT;           // text starts at LEFT_EXT from canvas left
            LOY = TOP_EXT;            // text starts at TOP_EXT from canvas top

            // Draw text on offscreen for pixel collision
            ocx.fillStyle = '#000';
            ocx.fillText(name, LOX, LOY + fontSize * 0.82); // baseline offset
            collData = ocx.getImageData(0, 0, W, H).data;
            ready = true;
        }

        function hit(x: number, y: number) {
            if (!ready || !collData) return false;
            const ix = Math.round(x), iy = Math.round(y);
            if (ix < 0 || iy < 0 || ix >= W || iy >= H) return false;
            return collData[(iy * W + ix) * 4 + 3] > 20;
        }

        function resize() {
            W = C.width = C.offsetWidth;
            H = C.height = C.offsetHeight;
            buildLogo();
        }

        // ── Physics ───────────────────────────────────────────────────────
        class Pt {
            x: number; y: number; ox: number; oy: number; done = false; st = 0;
            constructor(x: number, y: number, vx: number, vy: number) {
                this.x = x; this.y = y; this.ox = x - vx; this.oy = y - vy;
            }
            update() {
                if (this.done) return;
                const vx = (this.x - this.ox) * 0.97;
                const vy = (this.y - this.oy) * 0.97;
                this.ox = this.x; this.oy = this.y;
                this.x += vx; this.y += vy + 0.2;
                if (hit(this.x, this.y)) {
                    if (!hit(this.x, this.oy)) { this.y = this.oy; this.oy = this.y; }
                    else if (!hit(this.ox, this.y)) { this.x = this.ox; this.ox = this.x; }
                    else { this.x = this.ox; this.y = this.oy; }
                    this.ox = this.x; this.oy = this.y; this.st += 4;
                }
                if (this.y > H - 1) { this.y = H - 1; this.oy = this.y; this.st += 4; }
                if (this.y < 0) { this.y = 0; this.oy = 0; this.st += 4; }
                if (this.x < 0) this.x = 0;
                if (this.x > W) this.x = W;
                if (this.st > 14) this.done = true;
            }
        }

        class Lk {
            broken = false;
            constructor(public a: Pt, public b: Pt, public l = 2.5) { }
            solve() {
                if (this.broken) return;
                const dx = this.b.x - this.a.x, dy = this.b.y - this.a.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
                if (d > 25) { this.broken = true; return; }
                const f = (this.l - d) / d * 0.25;
                if (!this.a.done) { this.a.x -= dx * f; this.a.y -= dy * f; }
                if (!this.b.done) { this.b.x += dx * f; this.b.y += dy * f; }
            }
        }

        const COLS = ['#ff1493', '#00d9a0', '#ffc400', '#00b8ff', '#ff5533', '#b84dff'];
        const COLS_L = ['#ff6ec7', '#66ffc8', '#ffe066', '#66d9ff', '#ff9a75', '#d4a0ff'];

        class Strand {
            pts: Pt[] = []; lks: Lk[] = [];
            constructor(public ci: number) { }
            add(x: number, y: number, vx: number, vy: number) {
                const p = new Pt(x, y, vx, vy);
                if (this.pts.length) this.lks.push(new Lk(this.pts[this.pts.length - 1], p));
                this.pts.push(p);
            }
        }

        let strands: Strand[] = [];
        let cur: Strand | null = null;
        let ci = 0;
        let demoT = 0;
        let spT = 0;
        let isSpraying = false;

        // ── Spray can ─────────────────────────────────────────────────────
        const canScale = Math.max(0.833, scale);
        const CW = Math.round(18 * canScale), CH = Math.round(46 * canScale);
        const NX = Math.round(10 * canScale), NY = -CH / 2 - 3;

        function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
            ctx.beginPath();
            ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }

        function aimAngle(cx: number, cy: number) {
            // Aim at the text DIRECTLY below the can (not at text center)
            // This ensures each letter gets sprayed as the can passes over it
            const targetX = Math.max(LOX, Math.min(LOX + LW, cx));
            const rawA = Math.atan2(LOY + LH / 2 - cy, targetX - cx);
            // mostly vertical (0.3 = slight tilt for visual, not horizontal)
            return Math.atan2(Math.sin(rawA), Math.cos(rawA) * 0.3);
        }

        function tipWorld(cx: number, cy: number, rot: number) {
            return {
                x: cx + NX * Math.cos(rot) - NY * Math.sin(rot),
                y: cy + NX * Math.sin(rot) + NY * Math.cos(rot),
            };
        }

        function drawCan(cx: number, cy: number, alpha: number) {
            const a = aimAngle(cx, cy);
            X.save(); X.globalAlpha = alpha; X.translate(cx, cy); X.rotate(a);
            X.save();
            X.shadowColor = 'rgba(0,0,0,0.08)'; X.shadowBlur = 8; X.shadowOffsetY = 3;
            const bg = X.createLinearGradient(-CW / 2, 0, CW / 2, 0);
            bg.addColorStop(0, '#9a2020'); bg.addColorStop(0.13, '#d43530');
            bg.addColorStop(0.4, '#ee4e48'); bg.addColorStop(0.6, '#e84040');
            bg.addColorStop(0.85, '#d43530'); bg.addColorStop(1, '#8a1818');
            X.fillStyle = bg; rr(X, -CW / 2, -CH / 2, CW, CH, 4); X.fill(); X.restore();
            const m = X.createLinearGradient(-CW / 2, 0, CW / 2, 0);
            m.addColorStop(0, '#aaa'); m.addColorStop(0.4, '#ddd'); m.addColorStop(1, '#999');
            X.fillStyle = m;
            rr(X, -CW / 2 + 1, CH / 2 - 3, CW - 2, 3, 1); X.fill();
            rr(X, -CW / 2 + 1, -CH / 2, CW - 2, 3, 1); X.fill();
            X.fillStyle = 'rgba(255,255,255,0.08)';
            rr(X, -CW / 2 + 2, -5, CW - 4, 12, 2); X.fill();
            X.fillStyle = 'rgba(255,255,255,0.25)';
            X.font = 'bold 4px sans-serif'; X.textAlign = 'center';
            X.fillText('SILLY', 0, 1); X.fillText('STRING', 0, 5.5);
            X.fillStyle = m; rr(X, -5, -CH / 2 - 4, 10, 5, 2); X.fill();
            X.fillStyle = cur ? COLS[cur.ci] : '#d44';
            X.beginPath(); X.ellipse(0, -CH / 2 - 5, 4, 2, 0, 0, Math.PI * 2); X.fill();
            X.fillStyle = '#bbb'; X.beginPath();
            X.moveTo(2, -CH / 2 - 3); X.lineTo(NX - 1, NY - 1);
            X.lineTo(NX - 1, NY + 2); X.lineTo(2, -CH / 2 + 1);
            X.closePath(); X.fill();
            X.fillStyle = '#888'; X.beginPath(); X.arc(NX, NY, 2, 0, Math.PI * 2); X.fill();
            if (isSpraying && cur) {
                for (let i = 0; i < 3; i++) {
                    const d = 1 + Math.random() * 5;
                    X.fillStyle = COLS[cur.ci]; X.globalAlpha = alpha * (0.08 + Math.random() * 0.1);
                    X.beginPath(); X.arc(NX + d, NY + (Math.random() - 0.5) * 3, 0.3 + Math.random() * 0.4, 0, Math.PI * 2); X.fill();
                }
            }
            X.restore();
        }

        function emitFrom(cx: number, cy: number, count = 3) {
            if (!cur) return;
            spT++;
            const a = aimAngle(cx, cy);
            const tip = tipWorld(cx, cy, a);
            const pressure = 3 + 0.5 * 11;
            const curlAmt = 0.5 * 4;
            const chaos = 0.5 * 1.2;
            for (let j = 0; j < count; j++) {
                const speed = pressure + Math.random() * 2;
                const curl = Math.sin(spT * 0.35 + j * 1.7) * curlAmt;
                const wobble = (Math.random() - 0.5) * (0.15 + chaos);
                const pa = a + Math.PI / 2;
                cur.add(tip.x, tip.y,
                    Math.cos(a + wobble) * speed + Math.cos(pa) * curl,
                    Math.sin(a + wobble) * speed + Math.sin(pa) * curl
                );
            }
            let tot = 0;
            for (const s of strands) tot += s.pts.length;
            while (tot > 8000 && strands.length > 1) {
                const o = strands[0];
                if (o === cur) break;
                if (o.pts.length) { o.pts.shift(); o.lks.shift(); tot--; } else strands.shift();
            }
        }

        function drawStrands(alpha: number) {
            const thick = Math.max(1.2, 2.25 * scale);
            for (const s of strands) {
                if (s.pts.length < 2) continue;
                const { pts, lks } = s;
                const col = COLS[s.ci], colL = COLS_L[s.ci];
                X.lineCap = 'round'; X.lineJoin = 'round';
                X.beginPath(); X.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    if (i - 1 < lks.length && lks[i - 1].broken) { X.moveTo(pts[i].x, pts[i].y); continue; }
                    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
                    if (dx * dx + dy * dy > 600) { X.moveTo(pts[i].x, pts[i].y); continue; }
                    X.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y,
                        (pts[i - 1].x + pts[i].x) / 2, (pts[i - 1].y + pts[i].y) / 2);
                }
                X.save(); X.shadowColor = col; X.shadowBlur = 2;
                X.strokeStyle = col; X.globalAlpha = alpha * 0.12; X.lineWidth = thick + 2; X.stroke(); X.restore();
                X.strokeStyle = col; X.globalAlpha = alpha * 0.9; X.lineWidth = thick; X.stroke();
                X.strokeStyle = colL; X.globalAlpha = alpha * 0.2; X.lineWidth = thick * 0.3; X.stroke();
                X.globalAlpha = 1;
            }
        }

        // Time-based (not frame-based) so fps doesn't affect sweep speed
        const DELAY_MS = 3000;   // 3 second delay before spray starts
        const SPRAY_MS = 15000;  // 15 seconds spray
        const FADE_MS  = 5000;   // 5 seconds fade

        let startTime = 0;
        let emitAccum = 0;

        function tick(now: number) {
            // Don't start counting until collision data is ready
            if (!ready) {
                rafId = requestAnimationFrame(tick);
                return;
            }
            if (!startTime) startTime = now;
            const elapsed = now - startTime;

            const activeElapsed = elapsed - DELAY_MS; // time after delay
            const sprayProgress = Math.min(Math.max(activeElapsed, 0) / SPRAY_MS, 1);
            const spraying = activeElapsed >= 0 && activeElapsed < SPRAY_MS;
            isSpraying = spraying;

            // 3 passes: L→R, R→L, L→R (equal coverage)
            const PASS_MS = SPRAY_MS / 3;
            const passIndex = Math.min(Math.floor(Math.max(activeElapsed, 0) / PASS_MS), 2);
            const passProgress = Math.min((Math.max(activeElapsed, 0) % PASS_MS) / PASS_MS, 1);
            const sweepLeft  = LOX - Math.round(58 * Math.max(0.5, scale));
            const sweepRight = LOX + LW - Math.round(60 * scale);
            const canX = passIndex % 2 === 0
                ? sweepLeft  + passProgress * (sweepRight - sweepLeft)   // L→R
                : sweepRight - passProgress * (sweepRight - sweepLeft);  // R→L
            const canY = TOP_EXT * 0.3 + Math.sin(elapsed * 0.003) * 6;

            X.clearRect(0, 0, W, H);

            // Emit every ~33ms (≈ 30 emits/sec regardless of fps)
            if (spraying) {
                emitAccum += 1;
                // Emission scaled by font size (larger font = denser spray)
                const emitEvery    = passIndex === 0 ? Math.max(2, Math.round(2 / scale)) : Math.max(3, Math.round(3 / scale));
                const particlesPer = passIndex === 0 ? Math.max(1, Math.round(3 * scale)) : Math.max(1, Math.round(2 * scale));
                if (emitAccum >= emitEvery) {
                    emitAccum = 0;
                    if (!cur || cur.pts.length > Math.round(150 * scale)) {
                        cur = new Strand(ci++ % COLS.length);
                        strands.push(cur);
                        spT = 0;
                    }
                    emitFrom(canX, canY, particlesPer);
                }
            }

            for (const s of strands) {
                for (const p of s.pts) p.update();
                for (let i = 0; i < 2; i++) for (const k of s.lks) k.solve();
            }

            const fadeAlpha = activeElapsed > SPRAY_MS
                ? Math.max(0, 1 - (activeElapsed - SPRAY_MS) / FADE_MS)
                : 1;

            drawStrands(fadeAlpha);

            if (spraying) {
                drawCan(canX, canY, 1);
            }

            if (activeElapsed > SPRAY_MS + FADE_MS) return;

            rafId = requestAnimationFrame(tick);
        }

        resize();
        rafId = requestAnimationFrame(tick);

        const ro = new ResizeObserver(resize);
        ro.observe(C);

        return () => {
            cancelAnimationFrame(rafId);
            ro.disconnect();
        };
    }, [active, name, fontSize, topExt]);

    if (!active) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: `-${topExt}px`,
                left: '-40px',
                right: '-40px',
                bottom: '-20px',
                width: 'calc(100% + 80px)',
                height: `calc(100% + ${topExt + 20}px)`,
                pointerEvents: 'none',
                zIndex: 15,
            }}
        />
    );
}
