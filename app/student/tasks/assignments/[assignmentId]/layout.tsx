import type { Viewport } from 'next';

// The assignment paper is a fixed A4 sheet (210mm ≈ 794 CSS px). On a phone,
// the app-wide default viewport (`width=device-width, initial-scale=1`)
// leaves it zoomed in with only horizontal scrolling to see the rest, since
// the layout viewport is forced to the device's width while the actual
// content is much wider. Setting `width` here (with no `initialScale`) tells
// the browser the true layout width up front — mobile browsers then compute
// their own fit-to-width zoom automatically, so the whole paper is visible
// on first load. Must live in a plain Server Component (this file, no 'use
// client') because Next's `viewport` export doesn't work from Client
// Components — the actual page is one, hence this thin wrapper layout.
// Doing this via JS after the page has already loaded (mutating the meta
// tag at runtime) does NOT reliably reflow the viewport on most mobile
// engines, which is why this has to be a static, initial-HTML value instead.
export const viewport: Viewport = {
    width: 794,
};

export default function AssignmentPaperLayout({ children }: { children: React.ReactNode }) {
    return children;
}
