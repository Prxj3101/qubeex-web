'use client';

import { openPdf } from './formTemplate';
import type { FormTemplatePage } from './admissions.types';

// Finds the blanks on a page of a school's form, without any AI:
//   line - a solid underline or a dotted line to write on
//   box  - a small square tick box
//   comb - a row of letter boxes (one letter per box)
// Works on the picture of the page, so scans and PDFs are treated the same.
// Positions come out as fractions of the page (0-1).

export interface Candidate { n: number; kind: 'line' | 'box' | 'comb'; x: number; y: number; w: number; h: number; cells?: number; text?: string; after?: string; under?: string }

const WORK_WIDTH = 1400;

/** Draws a page (PDF page or photo) on a white canvas `WORK_WIDTH` wide. */
export async function pageCanvas(page: FormTemplatePage, width = WORK_WIDTH): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const height = Math.round(width * (page.height / page.width));
    canvas.width = width; canvas.height = height;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('Canvas not available');
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, width, height);
    if (page.type === 'pdf') {
        const p = await (await openPdf(page.url)).getPage(page.pdfPage + 1);
        const base = p.getViewport({ scale: 1 });
        const viewport = p.getViewport({ scale: width / base.width });
        await p.render({ canvasContext: c, viewport, canvas }).promise;
    } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('Could not read the page picture')); img.src = page.url; });
        c.drawImage(img, 0, 0, width, height);
    }
    return canvas;
}

type Comp = { x0: number; y0: number; x1: number; y1: number; count: number };

/** Every connected group of dark pixels, with its bounding box. */
function components(dark: Uint8Array, W: number, H: number): { comps: Comp[]; label: Int32Array } {
    const label = new Int32Array(W * H).fill(-1);
    const comps: Comp[] = [];
    const stack = new Int32Array(W * H);
    for (let start = 0; start < W * H; start++) {
        if (!dark[start] || label[start] !== -1) continue;
        const id = comps.length;
        const comp: Comp = { x0: W, y0: H, x1: 0, y1: 0, count: 0 };
        let top = 0;
        stack[top++] = start; label[start] = id;
        while (top) {
            const i = stack[--top];
            const x = i % W, y = (i - x) / W;
            comp.count++;
            if (x < comp.x0) comp.x0 = x; if (x > comp.x1) comp.x1 = x;
            if (y < comp.y0) comp.y0 = y; if (y > comp.y1) comp.y1 = y;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                const j = ny * W + nx;
                if (dark[j] && label[j] === -1) { label[j] = id; stack[top++] = j; }
            }
        }
        comps.push(comp);
    }
    return { comps, label };
}

/** Share of dark pixels along a row or a column segment. */
const rowShare = (dark: Uint8Array, W: number, y: number, x0: number, x1: number) => { let n = 0; for (let x = x0; x <= x1; x++) n += dark[y * W + x]; return n / (x1 - x0 + 1); };
const colShare = (dark: Uint8Array, W: number, x: number, y0: number, y1: number) => { let n = 0; for (let y = y0; y <= y1; y++) n += dark[y * W + x]; return n / (y1 - y0 + 1); };
/** Best share over a 3px band, so slightly tilted scans still count. */
const bandRow = (dark: Uint8Array, W: number, H: number, y: number, x0: number, x1: number) => Math.max(...[y - 1, y, y + 1].filter(v => v >= 0 && v < H).map(v => rowShare(dark, W, v, x0, x1)));
const bandCol = (dark: Uint8Array, W: number, x: number, y0: number, y1: number) => Math.max(...[x - 1, x, x + 1].filter(v => v >= 0 && v < W).map(v => colShare(dark, W, v, y0, y1)));

export function detectBlanks(canvas: HTMLCanvasElement): Candidate[] {
    const W = canvas.width, H = canvas.height;
    const px = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
    const dark = new Uint8Array(W * H);
    const inkish = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
        // Dark and not a light coloured watermark.
        dark[i] = (0.299 * r + 0.587 * g + 0.114 * b) < 135 && Math.min(r, g, b) < 120 ? 1 : 0;
        // Lines may be printed light grey: grey (not coloured like a watermark) also counts for lines.
        inkish[i] = dark[i] || ((0.299 * r + 0.587 * g + 0.114 * b) < 190 && Math.max(r, g, b) - Math.min(r, g, b) < 40) ? 1 : 0;
    }
    const { comps } = components(dark, W, H);
    const out: Omit<Candidate, 'n'>[] = [];
    const textH = Math.round(H * 0.016);
    const minLine = W * 0.045;

    for (const c of comps) {
        const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
        // Solid underlines are found row by row below (they may touch other lines).
        if (h <= 5 && w >= minLine) continue;
        if (h < 9 || h > 60 || w < 9) continue;
        const sides = bandRow(dark, W, H, c.y0, c.x0, c.x1) > 0.75 && bandRow(dark, W, H, c.y1, c.x0, c.x1) > 0.75
            && bandCol(dark, W, c.x0, c.y0, c.y1) > 0.75 && bandCol(dark, W, c.x1, c.y0, c.y1) > 0.75;
        if (!sides) continue;
        const fill = c.count / (w * h);
        // Small square tick box: four straight sides, empty inside.
        if (w <= 48 && w / h > 0.6 && w / h < 1.7 && fill < 0.45) {
            out.push({ kind: 'box', x: c.x0, y: c.y0, w, h });
            continue;
        }
        // Row of letter boxes: wide, with straight dividers inside.
        if (w >= h * 2.5 && w <= W * 0.9) {
            let dividers = 0, inRun = false;
            for (let x = c.x0; x <= c.x1; x++) {
                const on = colShare(dark, W, x, c.y0 + 1, c.y1 - 1) > 0.8;
                if (on && !inRun) dividers++;
                inRun = on;
            }
            const cells = dividers - 1;
            if (cells >= 3 && cells <= 80 && w / cells < h * 2.2) out.push({ kind: 'comb', x: c.x0, y: c.y0, w, h, cells });
        }
    }

    // Solid underlines, row by row: a long thin dark run with empty space above it.
    // Works even when the line runs into a photo box or a table edge.
    const runs: { x0: number; x1: number; y: number }[] = [];
    for (let y = 4; y < H - 4; y++) {
        let x = 0;
        while (x < W) {
            if (!inkish[y * W + x]) { x++; continue; }
            let end = x, gap = 0;
            // Small breaks (a watermark crossing the line) are bridged.
            for (let k = x; k < W; k++) {
                if (inkish[y * W + k]) { end = k; gap = 0; } else if (++gap > 14) break;
            }
            if (end - x + 1 >= minLine && rowShare(inkish, W, y, x, end) > 0.85) runs.push({ x0: x, x1: end, y });
            x = end + 3;
        }
    }
    // Rows of one thick line become one line.
    const lines: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const r of runs) {
        const l = lines.find(o => r.y - o.y1 <= 2 && r.x0 < o.x1 && r.x1 > o.x0);
        if (l) { l.y1 = r.y; l.x0 = Math.min(l.x0, r.x0); l.x1 = Math.max(l.x1, r.x1); }
        else lines.push({ x0: r.x0, x1: r.x1, y0: r.y, y1: r.y });
    }
    // Pieces of one line broken by a watermark are joined.
    lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
            const a = lines[i], b = lines[j];
            if (b.y0 - a.y1 > 2) break;
            // Only across a plain gap: a printed word between them ("Res.", "to") keeps them apart.
            const gapInk = () => { let n = 0; for (let y = Math.max(0, a.y0 - textH); y < a.y0 - 1; y++) n += rowShare(dark, W, y, Math.min(a.x1, b.x0), Math.max(a.x1, b.x0)); return n; };
            if (Math.abs(b.y0 - a.y0) <= 2 && b.x0 - a.x1 <= W * 0.06 && b.x1 > a.x0 - W * 0.06 && b.x0 < a.x1 + W * 0.06 && gapInk() < 0.3) {
                a.x0 = Math.min(a.x0, b.x0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
                lines.splice(j, 1); j = i;
            }
        }
    }
    // A blank starts where the printed words end: letters touching the line are trimmed off.
    const letterAbove = (x: number, y0: number) => { for (let y = y0 - 6; y <= y0 - 2; y++) if (y >= 0 && dark[y * W + x]) return true; return false; };
    const edge = new Set<typeof lines[number]>();
    const touchesUprightEarly = (x: number, y0: number, y1: number) => [x - 2, x - 1, x, x + 1, x + 2].some(cx => cx >= 0 && cx < W && (
        colShare(inkish, W, cx, Math.max(0, y0 - textH), Math.max(0, y0 - 2)) > 0.7 || colShare(inkish, W, cx, Math.min(H - 1, y1 + 2), Math.min(H - 1, y1 + textH)) > 0.7));
    // Both ends meet upright lines: an edge of a table, a box or a row of letter boxes.
    for (const l of lines) if (touchesUprightEarly(l.x0, l.y0, l.y1) && touchesUprightEarly(l.x1, l.y0, l.y1)) edge.add(l);
    // A table rule cut short by a watermark: at one end it runs on through an upright line.
    const runsThrough = (x: number, y: number, dir: 1 | -1) => {
        let n = 0;
        for (let k = 4; k <= 14; k++) { const cx = x + dir * k; if (cx >= 0 && cx < W && (inkish[y * W + cx] || inkish[Math.min(H - 1, y + 1) * W + cx])) n++; }
        return n >= 9;
    };
    for (const l of lines) {
        if ((touchesUprightEarly(l.x0, l.y0, l.y1) && runsThrough(l.x0, l.y0, -1)) || (touchesUprightEarly(l.x1, l.y0, l.y1) && runsThrough(l.x1, l.y0, 1))) edge.add(l);
    }
    // Two matching edges with upright dividers between them: a row of letter boxes
    // the shape search above missed (e.g. it touches another line).
    for (const top of lines) {
        if (!edge.has(top)) continue;
        const bottom = lines.find(m => m !== top && edge.has(m) && Math.abs(m.x0 - top.x0) < 8 && Math.abs(m.x1 - top.x1) < 8 && m.y0 - top.y1 >= 12 && m.y0 - top.y1 <= 60);
        if (!bottom) continue;
        const x0 = Math.min(top.x0, bottom.x0), x1 = Math.max(top.x1, bottom.x1), y0 = top.y0, y1 = bottom.y1;
        if (out.some(o => o.kind !== 'line' && o.x < x1 && o.x + o.w > x0 && o.y < y1 && o.y + o.h > y0)) continue;
        let dividers = 0, inRun = false;
        for (let x = x0; x <= x1; x++) {
            const on = colShare(inkish, W, x, y0 + 2, y1 - 2) > 0.8;
            if (on && !inRun) dividers++;
            inRun = on;
        }
        const cells = dividers - 1, h = y1 - y0 + 1, w = x1 - x0 + 1;
        if (cells >= 3 && cells <= 80 && w / cells < h * 2.2) out.push({ kind: 'comb', x: x0, y: y0, w, h, cells });
    }
    for (const l of lines) {
        // Skip past the last letter near each end (letters have small gaps between them).
        let last = -1, clear = 0;
        for (let x = l.x0; x <= l.x1 && clear < 12; x++) { if (letterAbove(x, l.y0)) { last = x; clear = 0; } else clear++; }
        if (last >= 0) l.x0 = last + 3;
        last = -1; clear = 0;
        for (let x = l.x1; x >= l.x0 && clear < 12; x--) { if (letterAbove(x, l.y0)) { last = x; clear = 0; } else clear++; }
        if (last >= 0) l.x1 = last - 3;
    }
    for (const l of lines) {
        const w = l.x1 - l.x0 + 1;
        if (l.y1 - l.y0 > 4 || w < minLine || w > W * 0.9) continue;   // a bar, a scrap or a page rule
        if (edge.has(l)) continue;
        // Words sitting on it: underlined text, not a blank.
        let ink = 0;
        for (let y = Math.max(0, l.y0 - textH); y < l.y0 - 2; y++) ink += rowShare(dark, W, y, l.x0 + 3, l.x1 - 3);
        if (ink / Math.max(1, textH - 2) > 0.1) continue;
        out.push({ kind: 'line', x: l.x0, y: Math.max(0, l.y0 - textH), w, h: textH + 2 });
    }

    // Dotted lines: many tiny dots in a straight row.
    const dots = comps.filter(c => c.x1 - c.x0 <= 4 && c.y1 - c.y0 <= 4).map(c => ({ x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 })).sort((a, b) => a.y - b.y || a.x - b.x);
    const used = new Uint8Array(dots.length);
    for (let i = 0; i < dots.length; i++) {
        if (used[i]) continue;
        const chain = [dots[i]];
        used[i] = 1;
        let last = dots[i];
        for (let j = i + 1; j < dots.length && dots[j].y - last.y <= 2.5; j++) {
            if (used[j]) continue;
            const d = dots[j];
            if (Math.abs(d.y - last.y) <= 2.5 && d.x > last.x && d.x - last.x <= 11) { chain.push(d); used[j] = 1; last = d; }
        }
        const span = chain[chain.length - 1].x - chain[0].x;
        if (chain.length >= 6 && span >= minLine) out.push({ kind: 'line', x: Math.round(chain[0].x), y: Math.max(0, Math.round(chain[0].y - textH)), w: Math.round(span), h: textH + 2 });
    }

    // Drop lines that are the edges of letter boxes or tick boxes.
    const solid = out.filter(o => o.kind !== 'line');
    const keep = out.filter(o => o.kind !== 'line' || !solid.some(s => o.x < s.x + s.w && o.x + o.w > s.x && o.y + o.h >= s.y - 3 && o.y <= s.y + s.h + 3));
    return keep
        .sort((a, b) => (Math.abs(a.y - b.y) < textH * 0.6 ? a.x - b.x : a.y - b.y))
        .slice(0, 300)
        .map((o, i) => ({ ...o, n: i + 1, x: o.x / W, y: o.y / H, w: o.w / W, h: o.h / H }));
}

/**
 * Every blank cut out with its own line of the form, one strip per blank,
 * numbered on the left. The AI reads each strip on its own, so a question can
 * never slide onto the next blank. Long pages give more than one picture.
 */
export function stripPictures(canvas: HTMLCanvasElement, list: Candidate[], perPicture = 40): string[] {
    const W = canvas.width, H = canvas.height;
    const OUT_W = 1100, GUTTER = 56, scale = (OUT_W - GUTTER) / W;
    const pictures: string[] = [];
    // At most 4 pictures (some AIs take only 5 pictures in one go, the page included).
    perPicture = Math.max(perPicture, Math.ceil(list.length / 4));
    for (let start = 0; start < list.length; start += perPicture) {
        const part = list.slice(start, start + perPicture);
        const rows = part.map(b => {
            const y = b.y * H, h = b.h * H;
            const top = Math.max(0, Math.round(y - h * 0.5)), bottom = Math.min(H, Math.round(y + h * 1.3));
            return { b, top, bottom, height: Math.round((bottom - top) * scale) + 8 };
        });
        const out = document.createElement('canvas');
        out.width = OUT_W; out.height = rows.reduce((n, r) => n + r.height, 0);
        const c = out.getContext('2d')!;
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, out.width, out.height);
        let oy = 0;
        for (const r of rows) {
            c.drawImage(canvas, 0, r.top, W, r.bottom - r.top, GUTTER, oy + 4, W * scale, (r.bottom - r.top) * scale);
            const bx = GUTTER + r.b.x * W * scale, by = oy + 4 + (r.b.y * H - r.top) * scale;
            c.strokeStyle = '#E11D48'; c.lineWidth = 2;
            c.strokeRect(bx, by, r.b.w * W * scale, r.b.h * H * scale);
            c.fillStyle = '#E11D48'; c.fillRect(0, oy, GUTTER - 6, r.height);
            c.fillStyle = '#ffffff'; c.font = 'bold 18px Arial, sans-serif';
            c.fillText(String(r.b.n), 6, oy + r.height / 2 + 6);
            oy += r.height;
            c.fillStyle = '#94a3b8'; c.fillRect(0, oy - 1, OUT_W, 1);
        }
        pictures.push(out.toDataURL('image/jpeg', 0.8));
    }
    return pictures;
}

/** The page with every blank boxed in red and numbered, for the AI to read. */
export function numberedPicture(canvas: HTMLCanvasElement, list: Candidate[], outWidth = 1000): string {
    // Drawn smaller than the work picture (fewer AI tokens); the strips carry the fine print.
    const k = Math.min(1, outWidth / canvas.width);
    const W = Math.round(canvas.width * k), H = Math.round(canvas.height * k);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const c = out.getContext('2d')!;
    c.drawImage(canvas, 0, 0, W, H);
    c.lineWidth = 2;
    c.font = 'bold 14px Arial, sans-serif';
    for (const b of list) {
        const x = b.x * W, y = b.y * H, w = b.w * W, h = b.h * H;
        c.strokeStyle = '#E11D48';
        c.strokeRect(x, y, w, h);
        // Number inside the blank, at its left end, right after the printed question.
        const tag = String(b.n);
        const tw = c.measureText(tag).width + 6;
        const tx = Math.min(W - tw, x + 2), ty = Math.min(H - 16, Math.max(0, y + h - 16));
        c.fillStyle = '#E11D48';
        c.fillRect(tx, ty, tw, 16);
        c.fillStyle = '#ffffff';
        c.fillText(tag, tx + 3, ty + 12);
    }
    return out.toDataURL('image/jpeg', 0.8);
}

/** Printed words of a PDF page (no words for photos or scanned PDFs), as page fractions. */
type Word = { str: string; x: number; y: number; w: number; h: number };
export async function pageWords(page: FormTemplatePage): Promise<Word[]> {
    if (page.type !== 'pdf') return [];
    try {
        const p = await (await openPdf(page.url)).getPage(page.pdfPage + 1) as unknown as {
            getViewport: (o: { scale: number }) => { width: number; height: number };
            getTextContent: () => Promise<{ items: { str?: string; transform?: number[]; width?: number; height?: number }[] }>;
        };
        const v = p.getViewport({ scale: 1 });
        const { items } = await p.getTextContent();
        return items
            .filter(i => i.str && i.str.trim() && i.transform)
            .map(i => {
                const t = i.transform!;
                const h = i.height || Math.abs(t[3]) || 10;
                return { str: i.str!, x: t[4] / v.width, y: (v.height - t[5] - h) / v.height, w: (i.width ?? 0) / v.width, h: h / v.height };
            });
    } catch { return []; }
}

/** Adds to each blank the printed words just before it on the same line. */
export function labelBlanks(list: Candidate[], words: Word[]): Candidate[] {
    if (!words.length) return list;
    const sameLine = (wd: Word, c: Candidate) => {
        const mid = wd.y + wd.h / 2;
        return mid >= c.y - c.h * 0.25 && mid <= c.y + c.h + c.h * 0.25;
    };
    const named = list.map(c => {
        // Start after the nearest blank on its left on the same line.
        const from = Math.max(0, ...list.filter(o => o !== c && o.x + o.w <= c.x + 0.002 && Math.abs((o.y + o.h / 2) - (c.y + c.h / 2)) < Math.max(o.h, c.h) * 0.6).map(o => o.x + o.w));
        // A PDF piece of text can run on into the blank ("Date of Birth______"):
        // keep only the letters that sit before the blank (and after the one before).
        const text = words
            .filter(wd => sameLine(wd, c) && wd.x < c.x - 0.002 && wd.x + wd.w > from + 0.002)
            .sort((a, b) => a.x - b.x)
            .map(wd => {
                const per = wd.w / Math.max(1, wd.str.length);
                const start = per > 0 ? Math.max(0, Math.round((from - 0.01 - wd.x) / per)) : 0;
                const end = per > 0 ? Math.min(wd.str.length, Math.round((c.x + 0.02 - wd.x) / per)) : wd.str.length;
                return wd.str.slice(start, end);
            })
            .join(' ')
            .replace(/[_.…]{2,}|_+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^[\s\-:]+|[\s\-:(]+$/g, '')
            .trim();
        // A tick box's choice is often printed after it ("[ ] Male").
        let after = '';
        if (c.kind === 'box') {
            const to = Math.min(1, ...list.filter(o => o !== c && o.x >= c.x + c.w - 0.002 && Math.abs((o.y + o.h / 2) - (c.y + c.h / 2)) < Math.max(o.h, c.h) * 0.6).map(o => o.x));
            after = words.filter(wd => sameLine(wd, c) && wd.x >= c.x + c.w - 0.004 && wd.x < to).sort((a, b) => a.x - b.x).map(wd => wd.str.trim()).join(' ').replace(/\s+/g, ' ').trim().slice(0, 40);
        }
        const out: Candidate = { ...c };
        if (text) out.text = text.slice(-110);
        if (after) out.after = after;
        return out;
    });
    // Whose question it is ("Occupation" under "Mother's Name"): the nearest
    // question above that names the mother, father or guardian.
    const PERSON = /\b(mother|father|guardian)/i;
    return named.map(c => {
        if (!c.text || PERSON.test(c.text)) return c;
        const owner = named
            .filter(o => o.text && PERSON.test(o.text) && o.y < c.y - 0.004 && c.y - o.y < 0.2)
            .sort((a, b) => b.y - a.y)[0];
        return owner ? { ...c, under: owner.text!.slice(0, 80) } : c;
    });
}

/**
 * Boxes whose printed question is, word for word, one of the form's questions
 * ("Date of Birth" = "Date of birth") are named here, without the AI. Anything
 * that is not certain (two boxes with the same words, a question asked for the
 * father and the mother, tick boxes, name parts) is left for the AI.
 */
const ALIASES: Record<string, string[]> = {
    childName: ['name of student', 'name of the student', 'name of the child', 'name of child', 'student name', 'students name', 'childs name', 'name of the learner', 'name of learner', 'name of the pupil', 'name of pupil', 'name master miss', 'full name of the child'],
    dob: ['date of birth', 'dob', 'birth date', 'date of birth dd mm yyyy'],
    gender: ['sex', 'gender', 'sex male female', 'gender male female', 'sex m f', 'sex boy girl', 'gender boy girl'],
    className: ['admission sought for class', 'admission sought for', 'class applying for', 'class to which admission is sought', 'admission for class', 'class in which admission is sought', 'admission required in class', 'admission sought in class'],
    bloodGroup: ['blood group', 'blood group of student', 'blood group of the student', 'blood group of the child'],
    motherTongue: ['mother tongue'],
    religion: ['religion'],
    category: ['category', 'social category'],
    childId: ['aadhar card no of student', 'aadhaar card no of student', 'aadhar card no', 'aadhaar card no', 'aadhar no', 'aadhaar no', 'aadhar number', 'aadhaar number', 'aadhar card number', 'aadhaar card number', 'aadhar card no of the student', 'aadhaar card no of the student'],
    fatherName: ['fathers name', 'name of father', 'father name', 'name of the father'],
    motherName: ['mothers name', 'name of mother', 'mother name', 'name of the mother'],
    city: ['city', 'city town', 'town city'],
    pincode: ['pin code', 'pincode', 'pin', 'postal code', 'pin code no'],
    previousSchool: ['name of the previous school', 'previous school', 'name of school last attended', 'school last attended', 'last school attended'],
    tcNumber: ['transfer certificate number', 'tc number', 'tc no', 'transfer certificate no'],
    medical: ['any physical ailment', 'allergies', 'medical conditions', 'any medical condition', 'allergies or medical conditions'],
};
export const normalizeLabel = (text: string) => text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/^\s*(\(?[0-9ivx]{1,4}[.)]|[a-z][.)])\s+/, '')
    .replace(/\s*'\s*s\b/g, 's')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function matchLocally(list: Candidate[], fields: { id: string; label: string }[]): { n: number; field: string }[] {
    const sameLabel = (a: string) => fields.filter(f => normalizeLabel(f.label) === a).length;
    const idsFor = (text: string): string[] => {
        const key = normalizeLabel(text);
        if (!key) return [];
        return fields.filter(f => {
            const own = normalizeLabel(f.label);
            return (own === key && sameLabel(own) === 1) || (ALIASES[f.id] ?? []).includes(key);
        }).map(f => f.id);
    };
    const found = list
        .filter(c => (c.kind === 'line' || (c.kind === 'comb' && !/\b(first|middle|last|sur)\s*name\b/i.test(c.text ?? ''))) && c.text)
        .map(c => ({ c, ids: idsFor(c.text!) }))
        .filter(x => x.ids.length === 1);
    // A question printed on two boxes (or two boxes naming one question) stays with the AI.
    const count = (id: string) => found.filter(x => x.ids[0] === id).length;
    const textCount = (t: string) => list.filter(c => c.text && normalizeLabel(c.text) === normalizeLabel(t)).length;
    return found.filter(x => count(x.ids[0]) === 1 && textCount(x.c.text!) === 1).map(x => ({ n: x.c.n, field: x.ids[0] }));
}
