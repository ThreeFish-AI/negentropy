import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { NavigationProvider } from "@/components/providers/NavigationProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Negentropy",
  description: "Agentic entropy reduction system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 dark:bg-zinc-950`}
      >
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider />
            <AuthProvider>
              <NavigationProvider>
                <div className="flex flex-col h-screen overflow-hidden">
                  <SiteHeader />
                  <main className="flex-1 overflow-hidden relative">{children}</main>
                </div>
              </NavigationProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
