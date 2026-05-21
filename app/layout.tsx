import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'QubeEx',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>        <ThemeProvider
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
