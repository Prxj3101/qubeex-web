import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'QubeEx',
};

// Runs synchronously before React hydrates or anything paints — same trick
// next-themes uses internally to avoid a flash of the wrong dark/light theme,
// applied here to the college color theme too. Without this, the server
// always renders the default violet 'SCHOOL' look (it has no way to know the
// real institution type), so every refresh briefly painted violet before
// React's client-side fetch/cache caught up and swapped it to blue — this
// script beats that first paint by setting the class straight from
// localStorage before the browser ever draws the page.
const NO_FLASH_INST_TYPE_SCRIPT = `
(function() {
  try {
    if (localStorage.getItem('qubeex:instType') === 'COLLEGE') {
      document.documentElement.classList.add('theme-college');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_INST_TYPE_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
