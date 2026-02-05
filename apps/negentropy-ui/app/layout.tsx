import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50`}
      >
        <ErrorBoundary>
          <AuthProvider>
            <div className="flex flex-col h-screen overflow-hidden">
              <SiteHeader />
              <main className="flex-1 overflow-hidden relative">{children}</main>
            </div>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
