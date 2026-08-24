import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { BrandingProvider } from '@/context/BrandingContext';

// Mirrors the qubeex_inst_type cookie pattern below — the qubeex_branding
// cookie carries the last-known institution brand name (empty when
// white-labeling isn't enabled) so the very first server-rendered <title>
// is already correct instead of always starting as "QubeEx" and flashing
// once BrandingProvider's client fetch resolves.
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const brandName = cookieStore.get('qubeex_branding')?.value;
  return { title: brandName ? decodeURIComponent(brandName) : 'QubeEx' };
}

// Reading cookies() below should already opt this layout into per-request
// rendering, but since it wraps the ENTIRE app, force it explicitly — if
// Next/Vercel ever manages to cache this shell (e.g. from a build-time
// prerender where no cookie exists), every single visitor would get stuck
// with whatever institution type was baked in at build time, which is
// exactly the "still flashing on every load" symptom
export const dynamic = 'force-dynamic';

// We used to inject a `beforeInteractive` next/script to flip the
// 'theme-college' class before first paint (avoiding a violet→blue flash on
// refresh). Next.js 16 + Turbopack throws "Encountered a script tag while
// rendering React component" for that pattern, and removing it brought the
// flash straight back (client-only class toggles are never fast enough for
// the very first paint on a hard refresh).

// Real fix: MockInstTypeContext now also mirrors the institution type into a
// cookie whenever it resolves it. Cookies travel with the request, so this
// Server Component can read it here and render 'theme-college' on <html>
// directly in the server-rendered HTML — correct from byte one, no script,
// no race, no flash. (First-ever visit before any cookie exists still
// briefly shows the default violet look same as it always would.)
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isCollege = cookieStore.get('qubeex_inst_type')?.value?.toUpperCase() === 'COLLEGE';

  return (
    <html lang="en" suppressHydrationWarning className={isCollege ? 'theme-college' : undefined}>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BrandingProvider>
            {children}
            <Toaster />
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
