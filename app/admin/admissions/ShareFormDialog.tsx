'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SecondaryButton } from '@/app/admin/payroll/_components/ui';
import { whatsappLink, type SettingsResponse } from './admissions.types';
import { AppleDoodle, BirdsDoodle, BookDoodle, BusDoodle, CloudDoodle, FlowersDoodle, KidDoodle, PencilDoodle, RulerDoodle, SchoolDoodle, StarDoodle, SunDoodle, TreeDoodle } from '@/app/apply/_components/Doodles';

type Place = { x: number; bottom: number; w: number; alpha?: number; rotate?: number; flip?: boolean };

/** Turns one of the form's doodles into a picture the canvas can draw. */
async function doodleImage(el: React.ReactElement): Promise<{ img: HTMLImageElement; ratio: number }> {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const markup = renderToStaticMarkup(el);
    const [, , vw, vh] = (markup.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 1 1').split(' ').map(Number);
    const ratio = vh / vw;
    // Big intrinsic size so the doodle stays sharp on the 3x poster.
    const svg = markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${vw * 6}" height="${vh * 6}"`);
    const img = new Image();
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('Doodle failed')); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
    return { img, ratio };
}

async function drawDoodle(c: CanvasRenderingContext2D, el: React.ReactElement, p: Place) {
    const { img, ratio } = await doodleImage(el);
    const h = p.w * ratio;
    c.save();
    c.globalAlpha = p.alpha ?? 1;
    c.translate(p.x + p.w / 2, p.bottom - h / 2);
    if (p.rotate) c.rotate((p.rotate * Math.PI) / 180);
    if (p.flip) c.scale(-1, 1);
    c.drawImage(img, -p.w / 2, -h / 2, p.w, h);
    c.restore();
}

/**
 * A shareable image: school name, session, the QR code and the link on the
 * same light school-themed background as the form, so the picture works on
 * WhatsApp, on a notice board and on a banner.
 */
/**
 * The school logo, or null when there is none or it cannot be read. It comes
 * through our API as a blob, because the storage bucket does not allow
 * cross-origin canvas use and would block the poster export.
 */
async function loadLogo(url: string | null | undefined): Promise<HTMLImageElement | null> {
    if (!url) return null;
    try {
        const res = await api.get('/admin/admissions/logo', { responseType: 'blob' });
        const blob = res.data as Blob;
        if (res.status !== 200 || !blob?.size) return null;
        const src = URL.createObjectURL(blob);
        return await new Promise(ok => {
            const logo = new Image();
            logo.onload = () => ok(logo);
            logo.onerror = () => { URL.revokeObjectURL(src); ok(null); };
            logo.src = src;
        });
    } catch { return null; }
}

async function makePoster(qr: string, school: string, logoUrl: string | null, session: string, link: string): Promise<{ blob: Blob; url: string }> {
    const img = new Image();
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('QR image failed')); img.src = qr; });
    // Laid out at 800 x 1080 and drawn at 3x, so text and QR stay sharp when
    // zoomed in WhatsApp or printed on an A4 sheet / banner.
    const logo = await loadLogo(logoUrl);
    const o = logo ? 96 : 0; // room for the logo above the school name
    const W = 800, H = 1080 + o, SCALE = 3, canvas = document.createElement('canvas');
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas not available');
    c.scale(SCALE, SCALE);

    // Soft sky to warm paper, with faint dots, like the form page.
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#DBEFFF'); sky.addColorStop(0.35, '#EEF7FF'); sky.addColorStop(1, '#FFF7ED');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(203,213,225,0.45)';
    for (let y = 13; y < H; y += 26) for (let x = 13; x < W; x += 26) { c.beginPath(); c.arc(x, y, 1.2, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#DA7756'; c.fillRect(0, 0, W, 12);

    // Sky and margin doodles, kept light so the text stays the hero.
    await drawDoodle(c, <SunDoodle />, { x: 18, bottom: 84, w: 58, alpha: 0.55 });
    await drawDoodle(c, <CloudDoodle />, { x: 706, bottom: 70, w: 78, alpha: 0.75 });
    if (logo) {
        c.save();
        c.shadowColor = 'rgba(15,23,42,0.14)'; c.shadowBlur = 18; c.shadowOffsetY = 4;
        c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(W / 2 - 48, 30, 96, 96, 24); c.fill();
        c.restore();
        const k = Math.min(80 / logo.naturalWidth, 80 / logo.naturalHeight);
        const lw = logo.naturalWidth * k, lh = logo.naturalHeight * k;
        c.drawImage(logo, W / 2 - lw / 2, 78 - lh / 2, lw, lh);
    }
    c.translate(0, o); // everything below moves down when there is a logo

    await drawDoodle(c, <PencilDoodle />, { x: 8, bottom: 360, w: 66, alpha: 0.4, rotate: 60 });
    await drawDoodle(c, <BookDoodle />, { x: 10, bottom: 580, w: 60, alpha: 0.4, rotate: -8 });
    await drawDoodle(c, <StarDoodle />, { x: 26, bottom: 760, w: 28, alpha: 0.5, rotate: 12 });
    await drawDoodle(c, <AppleDoodle />, { x: 734, bottom: 320, w: 38, alpha: 0.45, rotate: 8 });
    await drawDoodle(c, <StarDoodle />, { x: 740, bottom: 450, w: 24, alpha: 0.5, rotate: -12 });
    await drawDoodle(c, <RulerDoodle />, { x: 728, bottom: 640, w: 62, alpha: 0.4, rotate: -70 });
    await drawDoodle(c, <BirdsDoodle />, { x: 716, bottom: 790, w: 60, alpha: 0.45 });

    c.textAlign = 'center'; c.fillStyle = '#111827';
    const fit = (text: string, size: number, weight: string) => {
        let px = size;
        do { c.font = `${weight} ${px}px "Segoe UI", Arial, sans-serif`; px -= 2; } while (c.measureText(text).width > W - 180 && px > 18);
    };
    fit(school, 46, '700'); c.fillText(school, W / 2, 96);
    c.fillStyle = '#4B5563'; fit(`Admissions open - Session ${session}`, 30, '500'); c.fillText(`Admissions open - Session ${session}`, W / 2, 146);

    // White card behind the QR so phones always read it cleanly.
    c.save();
    c.shadowColor = 'rgba(15,23,42,0.16)'; c.shadowBlur = 30; c.shadowOffsetY = 10;
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(84, 174, 632, 632, 36); c.fill();
    c.restore();
    c.imageSmoothingEnabled = false; // keep the QR squares crisp
    c.drawImage(img, (W - 600) / 2, 190, 600, 600);
    c.imageSmoothingEnabled = true;
    c.fillStyle = '#111827'; c.font = '600 30px "Segoe UI", Arial, sans-serif'; c.fillText('Scan with your phone camera to apply', W / 2, 860);
    c.fillStyle = '#4B5563'; fit(link, 22, '400'); c.fillText(link, W / 2, 900);

    // School street at the bottom: hills, trees, bus, kids and the school.
    c.save();
    c.translate(0, 880); c.scale(W / 1440, 200 / 240);
    [['M0 132 C220 80 420 160 720 116 C1010 72 1210 150 1440 104 V240 H0 Z', '#BBF7D0'],
     ['M0 176 C260 140 520 200 820 164 C1100 130 1280 186 1440 164 V240 H0 Z', '#86EFAC'],
     ['M0 214 C300 196 640 226 940 206 C1180 192 1320 214 1440 206 V240 H0 Z', '#7DDB9B']]
        .forEach(([d, fill]) => { c.fillStyle = fill; c.fill(new Path2D(d)); });
    c.restore();
    await drawDoodle(c, <TreeDoodle />, { x: 6, bottom: 1044, w: 44 });
    await drawDoodle(c, <BusDoodle />, { x: 58, bottom: 1048, w: 110 });
    await drawDoodle(c, <FlowersDoodle />, { x: 172, bottom: 1064, w: 48 });
    await drawDoodle(c, <KidDoodle shirt="#FFFFFF" bottom="#1E3A8A" bag="#60A5FA" hairStyle="short" />, { x: 222, bottom: 1060, w: 38 });
    await drawDoodle(c, <KidDoodle skin="#C68B59" hair="#111827" hairStyle="ponytail" skirt bottom="#9D174D" bag="#FBBF24" />, { x: 264, bottom: 1060, w: 38 });
    await drawDoodle(c, <FlowersDoodle />, { x: 500, bottom: 1064, w: 44 });
    await drawDoodle(c, <KidDoodle skin="#E8B48A" hair="#1F2937" hairStyle="curly" bottom="#1E3A8A" bag="#34D399" wave />, { x: 540, bottom: 1060, w: 38, flip: true });
    await drawDoodle(c, <KidDoodle skin="#8D5A3B" hair="#111827" hairStyle="bun" skirt bottom="#1E3A8A" bag="#F472B6" />, { x: 582, bottom: 1060, w: 36, flip: true });
    await drawDoodle(c, <SchoolDoodle />, { x: 622, bottom: 1042, w: 120 });
    await drawDoodle(c, <TreeDoodle />, { x: 750, bottom: 1044, w: 40 });

    c.fillStyle = '#14532D'; c.font = '600 16px "Segoe UI", Arial, sans-serif'; c.fillText('Powered by QubeEx', W / 2, 1064);
    const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error('Could not make the image'))), 'image/png'));
    return { blob, url: URL.createObjectURL(blob) };
}

/**
 * The school's own registration form: a link parents open on their phone, and
 * the same link as a QR code to print on a banner or notice board.
 */
export default function ShareFormDialog({ open, onClose, setup, onSettings }: { open: boolean; onClose: () => void; setup: SettingsResponse; onSettings: () => void }) {
    const link = useMemo(() => (typeof window === 'undefined' ? '' : `${window.location.origin}/apply/${encodeURIComponent(setup.school.formCode)}`), [setup.school.formCode]);
    const [qr, setQr] = useState('');
    const [poster, setPoster] = useState<{ blob: Blob; url: string } | null>(null);

    useEffect(() => {
        if (!open || !link) return;
        let alive = true;
        QRCode.toDataURL(link, { width: 1800, margin: 2, errorCorrectionLevel: 'M' })
            .then(url => { if (alive) setQr(url); return makePoster(url, setup.school.name, setup.school.logoUrl ?? null, setup.session.label, link); })
            .then(p => { if (alive) setPoster(p); else URL.revokeObjectURL(p.url); })
            .catch(() => {});
        return () => { alive = false; };
    }, [open, link, setup.school.name, setup.school.logoUrl, setup.session.label]);
    useEffect(() => () => { if (poster) URL.revokeObjectURL(poster.url); }, [poster]);

    const message = `Admissions are open at ${setup.school.name} for session ${setup.session.label}. Fill the registration form here: ${link}`;
    const fileName = `admission-form-${setup.school.formCode}.png`;

    // WhatsApp links can only carry text, so the picture goes another way:
    // the phone or computer share sheet sends picture + text together (pick
    // WhatsApp there); where that is not available, the picture is copied and
    // WhatsApp opens with the text, ready to paste the picture in.
    const shareOnWhatsApp = () => {
        if (!poster) return;
        const file = new File([poster.blob], fileName, { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], text: message }).catch(err => {
                if ((err as DOMException)?.name !== 'AbortError') toast.error('Could not open sharing');
            });
            return;
        }
        const copied = typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write
            ? navigator.clipboard.write([new ClipboardItem({ 'image/png': poster.blob })])
            : Promise.reject(new Error('no clipboard'));
        window.open(whatsappLink(message), '_blank', 'noopener,noreferrer');
        copied.then(
            () => toast.success('QR picture copied. In the WhatsApp chat, press Ctrl+V to add it with the link.', { duration: 8000 }),
            () => toast.message('WhatsApp opened with the link. Download the QR picture and attach it in the chat.', { duration: 8000 }),
        );
    };

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-md bg-card">
                <DialogHeader>
                    <DialogTitle>Share the registration form</DialogTitle>
                    <DialogDescription>Parents scan the QR code or open the link on their phone and fill the form. WhatsApp sends the picture and the link together.</DialogDescription>
                </DialogHeader>
                {!setup.settings.formOpen && (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                        The form is closed right now, so parents will see &quot;Admissions are closed&quot;. <button type="button" onClick={onSettings} className="font-semibold underline">Open it in settings</button>
                    </p>
                )}
                <div className="flex flex-col items-center gap-3">
                    {poster ? <img src={poster.url} alt="Admission form picture with QR code and link" className="w-44 rounded-xl border border-border bg-white" />
                        : qr ? <img src={qr} alt="QR code for the registration form" className="w-44 h-44 rounded-xl bg-white p-2" /> : <div className="w-44 h-56 rounded-xl bg-muted animate-pulse" />}
                    <div className="w-full flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                        <span className="flex-1 truncate text-xs font-mono">{link}</span>
                        <button type="button" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(link).then(() => toast.success('Link copied'), () => toast.error('Could not copy')); }} className="text-muted-foreground hover:text-foreground"><Copy size={14} /></button>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={shareOnWhatsApp} disabled={!poster} title="Send the QR picture and the link together" className="inline-flex flex-col items-center gap-1 rounded-xl border border-border py-3 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50">
                        <FaWhatsapp size={20} className="text-[#25D366]" />WhatsApp
                    </button>
                    <a href={poster?.url} download={fileName} aria-disabled={!poster} className={`inline-flex flex-col items-center gap-1 rounded-xl border border-border py-3 text-xs font-semibold hover:bg-muted/50 ${poster ? '' : 'pointer-events-none opacity-50'}`}>
                        <Download size={18} />QR picture
                    </a>
                    <a href={link || undefined} target="_blank" rel="noopener noreferrer" className="inline-flex flex-col items-center gap-1 rounded-xl border border-border py-3 text-xs font-semibold hover:bg-muted/50">
                        <ExternalLink size={18} />Open form
                    </a>
                </div>
                <div className="flex justify-end"><SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton></div>
            </DialogContent>
        </Dialog>
    );
}
